import { CorreoAccesoOutboxService } from './correo-acceso-outbox.service';
import { AuthCorreoOutbox } from '../entities/auth-correo-outbox.entity';
import { ActivacionToken } from '../entities/activacion-token.entity';
import { PasswordResetToken } from '../entities/password-reset-token.entity';
import { Usuario } from '../entities/usuario.entity';

describe.each(['ACTIVACION', 'RECUPERACION'] as const)('Renovación de código %s', tipo => {
  const crear = (existente: { estado: string; proximoIntento: Date } | null) => {
    const usuario = { id: 7, activo: true, sessionVersion: 1, activacionPendiente: tipo === 'ACTIVACION' };
    const usuarios = { findOne: jest.fn().mockResolvedValue(usuario) };
    const trabajos = {
      findOne: jest.fn().mockResolvedValue(existente),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      insert: jest.fn().mockResolvedValue({ identifiers: [{}] }),
    };
    const tokens = { update: jest.fn().mockResolvedValue({ affected: 1 }) };
    const manager = { getRepository: jest.fn((entity: unknown) => {
      if (entity === Usuario) return usuarios;
      if (entity === AuthCorreoOutbox) return trabajos;
      if (entity === ActivacionToken || entity === PasswordResetToken) return tokens;
      throw new Error('Entidad inesperada');
    }) };
    const ds = {
      getRepository: jest.fn(() => usuarios),
      transaction: jest.fn(async (_nivel: string, fn: (m: typeof manager) => Promise<void>) => fn(manager)),
    };
    const config = { get: jest.fn(() => undefined) };
    const service = new CorreoAccesoOutboxService(ds as never, {} as never, config as never, {} as never);
    return { service, trabajos, tokens };
  };

  it('invalida el código previo antes de insertar otro después del cooldown', async () => {
    const { service, trabajos, tokens } = crear({ estado: 'ACEPTADO', proximoIntento: new Date(Date.now() - 65_000) });
    await service.solicitar('alumno@example.test', tipo);
    expect(trabajos.update).toHaveBeenCalledWith(
      expect.objectContaining({ usuarioId: 7, tipo }),
      expect.objectContaining({ estado: 'CANCELADO' }),
    );
    expect(tokens.update).toHaveBeenCalledWith({ usuarioId: 7, usado: false }, { usado: true });
    expect(trabajos.insert).toHaveBeenCalledTimes(1);
    expect(tokens.update.mock.invocationCallOrder[0]).toBeLessThan(trabajos.insert.mock.invocationCallOrder[0]);
  });

  it('mantiene el código dentro del cooldown', async () => {
    const { service, trabajos, tokens } = crear({ estado: 'ACEPTADO', proximoIntento: new Date(Date.now() - 10_000) });
    await service.solicitar('alumno@example.test', tipo);
    expect(trabajos.insert).not.toHaveBeenCalled();
    expect(tokens.update).not.toHaveBeenCalled();
  });

  it('no genera otro mientras está en proceso el correo', async () => {
    const { service, trabajos } = crear({ estado: 'PROCESANDO', proximoIntento: new Date(Date.now() - 65_000) });
    await service.solicitar('alumno@example.test', tipo);
    expect(trabajos.insert).not.toHaveBeenCalled();
  });
});
