import { BadRequestException, Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { DataSource } from 'typeorm';
import { ActivacionToken } from '../entities/activacion-token.entity';
import { PasswordResetToken } from '../entities/password-reset-token.entity';
import { hashPasswordNueva } from '../common/password-bcrypt';
import { Usuario } from '../entities/usuario.entity';
import { CorreoAccesoOutboxService } from './correo-acceso-outbox.service';

const RESPUESTA = { mensaje: 'Si la cuenta está pendiente y el correo está disponible, recibirás instrucciones. Si no llegan, contacta a Control escolar.' };

@Injectable()
export class ActivacionService {
  constructor(private readonly ds: DataSource, private readonly outbox: CorreoAccesoOutboxService) {}
  async solicitar(email: string) {
    await this.outbox.solicitar(email, 'ACTIVACION');
    return RESPUESTA;
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
