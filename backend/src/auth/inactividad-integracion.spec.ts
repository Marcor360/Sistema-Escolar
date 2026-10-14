import { UnauthorizedException } from '@nestjs/common';
import { Sesion } from '../entities/sesion.entity';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';

const ahora = new Date('2026-10-14T18:00:00Z');
const payload = { sub: 1, sid: 'sesion-uno', ver: 0, kind: 'ACCESS' as const, email: 'alumno@example.invalid', nombre: 'Alumno', roles: ['ALUMNO'] };
const usuario = { id: 1, email: 'alumno@example.invalid', nombreCompleto: 'Alumno',
  sessionVersion: 0, activo: true, roles: [{ clave: 'ALUMNO' }] };

describe('Sesiones inactivas: seguridad de la API', () => {
  beforeEach(() => jest.useFakeTimers({ now: ahora }));
  afterEach(() => jest.useRealTimers());

  function estrategia(ultimaActividadEn: Date | null) {
    const builder = { update: jest.fn().mockReturnThis(), set: jest.fn().mockReturnThis(), where: jest.fn().mockReturnThis(), andWhere: jest.fn().mockReturnThis(), execute: jest.fn().mockResolvedValue({ affected: 1 }) };
    const sesiones = {
      findOne: jest.fn().mockResolvedValue({
        id: payload.sid, usuarioId: payload.sub, version: 0,
        expiraEn: new Date(ahora.getTime() + 60_000), ultimaActividadEn,
      }),
      createQueryBuilder: jest.fn(() => builder),
    };
    const usuarios = { findOne: jest.fn().mockResolvedValue(usuario),
      manager: { getRepository: jest.fn(() => sesiones) } };
    const strategy = new JwtStrategy({ get: () => 'test-secret' } as never, usuarios as never,
      { findOne: jest.fn().mockResolvedValue({ id: 1 }) } as never, {} as never);
    return { sesiones, strategy, builder };
  }

  it('cierra acceso por JWT si la última actividad ocurrió hace 30 minutos', async () => {
    const { strategy, builder } = estrategia(new Date(ahora.getTime() - 1_800_000));
    await expect(strategy.validate(payload)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(builder.set).toHaveBeenCalledWith({ revocada: true });
    expect(builder.andWhere).toHaveBeenCalledWith(expect.stringContaining('ultima_actividad_en <= :umbral'), expect.objectContaining({ umbral: new Date(ahora.getTime() - 1_800_000) }));
  });

  it('no actualiza la actividad al validar una petición automática', async () => {
    const { strategy, sesiones } = estrategia(new Date(ahora.getTime() - 10_000));
    await expect(strategy.validate(payload)).resolves.toMatchObject({ sub: 1, sid: 'sesion-uno' });
    expect(sesiones.createQueryBuilder).not.toHaveBeenCalled();
  });

  it('no revoca una actividad actualizada entre lectura y revocación', async () => {
    const { strategy, sesiones, builder } = estrategia(new Date(ahora.getTime() - 1_800_000));
    builder.execute.mockResolvedValue({ affected: 0 });
    sesiones.findOne.mockResolvedValueOnce({ version: 0, expiraEn: new Date(ahora.getTime() + 60000), ultimaActividadEn: new Date(ahora.getTime() - 1800000) })
      .mockResolvedValueOnce({ version: 0, expiraEn: new Date(ahora.getTime() + 60000), ultimaActividadEn: ahora });
    await expect(strategy.validate(payload)).resolves.toMatchObject({ sub: 1 });
  });

  function servicioConRepo(sesiones: Record<string, unknown>) {
    const source = { transaction: jest.fn(async (callback: (manager: {
      getRepository: (modelo: typeof Sesion) => typeof sesiones,
    }) => Promise<unknown>) => callback({ getRepository: () => sesiones })),
      getRepository: jest.fn(() => sesiones),
    };
    const jwt = { verify: jest.fn(() => ({ sub: 1, sid: 'sesion-uno', kind: 'REFRESH', portal: 'MOVIL' })) };
    const auth = new AuthService({} as never, {} as never, {} as never, jwt as never,
      {} as never, {} as never, source as never);
    return { auth, source };
  }

  it('no permite renovar un refresh aunque el token criptográfico siga vigente', async () => {
    const sesiones = {
      findOne: jest.fn().mockResolvedValue({
        id: 'sesion-uno', usuarioId: 1, portal: 'MOVIL', revocada: false,
        expiraEn: new Date(ahora.getTime() + 60_000),
        ultimaActividadEn: new Date(ahora.getTime() - 1_800_000),
      }),
      save: jest.fn().mockResolvedValue(undefined),
    };
    const { auth } = servicioConRepo(sesiones);
    await expect(auth.refresh('token-refresco', 'MOVIL')).rejects.toBeInstanceOf(UnauthorizedException);
    expect(sesiones.save).toHaveBeenCalledWith(expect.objectContaining({ revocada: true }));
  });

  it('acepta latidos explícitos autorizados y rechaza sesiones vencidas de forma atómica', async () => {
    const ejecutar = jest.fn().mockResolvedValueOnce({ affected: 1 }).mockResolvedValueOnce({ affected: 0 });
    const builder = {
      update: jest.fn().mockReturnThis(), set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(), andWhere: jest.fn().mockReturnThis(),
      execute: ejecutar,
    };
    const { auth } = servicioConRepo({ createQueryBuilder: () => builder });
    await expect(auth.registrarActividad(payload)).resolves.toEqual({ mensaje: 'Actividad registrada' });
    expect(builder.andWhere).toHaveBeenCalledWith(
      'ultima_actividad_en > :umbral AND ultima_actividad_en <= :ahora',
      expect.objectContaining({ umbral: new Date(ahora.getTime() - 1_800_000) }),
    );
    await expect(auth.registrarActividad(payload)).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
