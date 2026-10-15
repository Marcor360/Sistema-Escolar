import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { DataSource } from 'typeorm';
import { ActivacionToken } from '../entities/activacion-token.entity';
import { Usuario } from '../entities/usuario.entity';
import { hashPasswordNueva } from '../common/password-bcrypt';
import { NotificacionesService } from '../notificaciones/notificaciones.service';

const RESPUESTA = { mensaje: 'Si la cuenta está pendiente y el correo está disponible, recibirás instrucciones. Si no llegan, contacta a Control escolar.' };
const VIGENCIA_MS = 60 * 60 * 1000;

@Injectable()
export class ActivacionService {
  private readonly logger = new Logger(ActivacionService.name);
  constructor(private readonly ds: DataSource, private readonly notificaciones: NotificacionesService) {}

  /** El token solo existe en memoria para el envío, jamás se devuelve ni se registra. */
  async solicitar(email: string) {
    const usuario = await this.ds.getRepository(Usuario).findOne({ where: { email, activo: true, activacionPendiente: true } });
    if (!usuario) return RESPUESTA;
    const token = randomBytes(32).toString('hex');
    const hash = createHash('sha256').update(token).digest('hex');
    await this.ds.transaction(async (manager) => {
      const actual = await manager.getRepository(Usuario).findOne({ where: { id: usuario.id, activo: true, activacionPendiente: true }, lock: { mode: 'pessimistic_write' } });
      if (!actual) return;
      await manager.getRepository(ActivacionToken).update({ usuarioId: actual.id, usado: false }, { usado: true });
      await manager.getRepository(ActivacionToken).insert({
        id: randomUUID(), usuarioId: actual.id, token: hash,
        expiraEn: new Date(Date.now() + VIGENCIA_MS), usado: false, intentos: 0,
      });
    });
    const enviado = await this.notificaciones.enviarEmail(usuario.email,
      'Activación de tu cuenta escolar',
      '<p>Para activar tu cuenta, escribe este código de un solo uso en la pantalla de activación:</p>' +
      '<p><strong>' + token + '</strong></p><p>El código vence en una hora. Si no lo solicitaste, ignora este correo.</p>',
    ).catch(() => {
      this.logger.warn('No se pudo enviar una invitación de activación; el titular puede solicitar otra');
      return { simulado: true };
    });
    if (enviado.simulado) this.logger.warn('Activación pendiente: servicio de correo no disponible');
    return RESPUESTA;
  }

  async activar(token: string, nueva: string) {
    const hash = createHash('sha256').update(token).digest('hex');
    const existente = await this.ds.getRepository(ActivacionToken).findOne({ where: { token: hash, usado: false } });
    if (!existente) throw new BadRequestException('Código de activación inválido o vencido');
    // Fuera de la transacción para mantener corto el bloqueo por usuario.
    const passwordHash = await hashPasswordNueva(nueva);
    await this.ds.transaction(async (manager) => {
      const usuarios = manager.getRepository(Usuario);
      const usuario = await usuarios.findOne({ where: { id: existente.usuarioId, activo: true }, lock: { mode: 'pessimistic_write' } });
      if (!usuario?.activacionPendiente) throw new BadRequestException('Código de activación inválido o vencido');
      const tokens = manager.getRepository(ActivacionToken);
      const registro = await tokens.findOne({ where: { id: existente.id, usuarioId: usuario.id, usado: false }, lock: { mode: 'pessimistic_write' } });
      if (!registro || registro.expiraEn <= new Date()) throw new BadRequestException('Código de activación inválido o vencido');
      const consumo = await tokens.update({ id: registro.id, usuarioId: usuario.id, usado: false }, { usado: true });
      if (consumo.affected !== 1) throw new BadRequestException('Código de activación inválido o vencido');
      await usuarios.update({ id: usuario.id, activo: true, activacionPendiente: true }, {
        passwordHash, activacionPendiente: false, passwordChangeRequired: false,
        sessionVersion: () => 'COALESCE(session_version, 0) + 1',
      });
      await tokens.update({ usuarioId: usuario.id, usado: false }, { usado: true });
    });
    return { mensaje: 'Cuenta activada. Inicia sesión con tu correo y contraseña.' };
  }
}
