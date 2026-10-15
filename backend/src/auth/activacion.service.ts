import { BadRequestException, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { DataSource } from 'typeorm';
import { ActivacionToken } from '../entities/activacion-token.entity';
import { PasswordResetToken } from '../entities/password-reset-token.entity';
import { Usuario } from '../entities/usuario.entity';
import { hashPasswordNueva } from '../common/password-bcrypt';
import { NotificacionesService } from '../notificaciones/notificaciones.service';

const RESPUESTA = { mensaje: 'Si la cuenta está pendiente y el correo está disponible, recibirás instrucciones. Si no llegan, contacta a Control escolar.' };
const VIGENCIA_MS = 60 * 60 * 1000;

@Injectable()
export class ActivacionService implements OnModuleDestroy {
  private cola: Promise<void> = Promise.resolve();
  private pendientes = 0;
  private readonly logger = new Logger(ActivacionService.name);
  constructor(private readonly ds: DataSource, private readonly notificaciones: NotificacionesService) {}

  /** Cola acotada y efímera: la respuesta no espera consultas ni SMTP. */
  async solicitar(email: string) {
    if (this.pendientes < 100) {
      this.pendientes++;
      this.cola = this.cola
        .then(() => new Promise<void>((resolve) => setImmediate(resolve)))
        .then(() => this.emitir(email))
        .catch(() => this.logger.warn('Invitación no enviada; el titular puede solicitar otra'))
        .finally(() => { this.pendientes--; });
    }
    return RESPUESTA;
  }

  async onModuleDestroy() { await this.cola; }

  /** La exclusión por usuario abarca emisión y aceptación SMTP, incluso entre procesos. */
  private async emitir(email: string) {
    const usuario = await this.ds.getRepository(Usuario).findOne({ where: { email, activo: true, activacionPendiente: true } });
    if (!usuario) return;
    await this.ds.transaction(async (manager) => {
      const actual = await manager.getRepository(Usuario).findOne({ where: { id: usuario.id, activo: true, activacionPendiente: true }, lock: { mode: 'pessimistic_write' } });
      if (!actual) return;
      const token = randomBytes(32).toString('hex');
      const hash = createHash('sha256').update(token).digest('hex');
      await manager.getRepository(ActivacionToken).update({ usuarioId: actual.id, usado: false }, { usado: true });
      await manager.getRepository(ActivacionToken).insert({
        id: randomUUID(), usuarioId: actual.id, token: hash,
        expiraEn: new Date(Date.now() + VIGENCIA_MS), usado: false, intentos: 0,
      });
      // SMTP tiene timeouts. Si falla, rollback conserva la invitación anterior.
      const enviado = await this.notificaciones.enviarEmail(actual.email,
        'Activación de tu cuenta escolar',
        '<p>Para activar tu cuenta, escribe este código de un solo uso en la pantalla de activación:</p>' +
        '<p><strong>' + token + '</strong></p><p>El código vence en una hora. Si no lo solicitaste, ignora este correo.</p>',
      );
      if (enviado.simulado) throw new Error('Servicio de correo no disponible');
    });
  }

  async activar(token: string, nueva: string) {
    const hash = createHash('sha256').update(token).digest('hex');
    const existente = await this.ds.getRepository(ActivacionToken).findOne({ where: { token: hash, usado: false } });
    if (!existente || existente.expiraEn <= new Date()) throw new BadRequestException('Código de activación inválido o vencido');
    // Fuera de la transacción para mantener corto el bloqueo por usuario.
    if (nueva.length < 8) throw new BadRequestException('La contraseña debe tener al menos 8 caracteres');
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
      const activado = await usuarios.update({ id: usuario.id, activo: true, activacionPendiente: true }, {
        passwordHash, activacionPendiente: false, passwordChangeRequired: false,
        sessionVersion: () => 'COALESCE(session_version, 0) + 1',
      });
      if (activado.affected !== 1) throw new BadRequestException('Código de activación inválido o vencido');
      await tokens.update({ usuarioId: usuario.id, usado: false }, { usado: true });
      await manager.getRepository(PasswordResetToken).update({ usuarioId: usuario.id, usado: false }, { usado: true });
    });
    return { mensaje: 'Cuenta activada. Inicia sesión con tu correo y contraseña.' };
  }
}
