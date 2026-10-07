import { UnauthorizedException } from '@nestjs/common';
import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy.validate', () => {
  const config = { get: jest.fn(() => 'test-secret') } as any;
  const payload = { sub: 4, email: 'old@example.invalid', nombre: 'Nombre anterior', roles: ['ADMINISTRATIVO'], sid: 'test-session', kind: 'ACCESS' as const };

  it('rechaza tokens de usuarios desactivados o eliminados', async () => {
    const usuarios = { manager: { getRepository: jest.fn(() => ({ findOne: jest.fn().mockResolvedValue({ version: 0, expiraEn: new Date(Date.now() + 60_000) }) })) }, findOne: jest.fn().mockResolvedValue(null) };
    const strategy = new JwtStrategy(config, usuarios as any, {} as any, {} as any);
    await expect(strategy.validate(payload)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(usuarios.findOne).toHaveBeenCalledWith({ where: { id: 4, activo: true } });
  });

  it('carga correo, nombre y roles vigentes desde la base', async () => {
    const usuarios = { manager: { getRepository: jest.fn(() => ({ findOne: jest.fn().mockResolvedValue({ version: 0, expiraEn: new Date(Date.now() + 60_000) }) })) },
      findOne: jest.fn().mockResolvedValue({
        id: 4, email: 'nuevo@example.invalid', nombreCompleto: 'Nombre actualizado',
        roles: [{ clave: 'MAESTRO' }],
      }),
    };
    const strategy = new JwtStrategy(config, usuarios as any,
      { findOne: jest.fn().mockResolvedValue({ id: 3 }) } as any,
      { findOne: jest.fn().mockResolvedValue({ id: 2 }) } as any);
    await expect(strategy.validate(payload)).resolves.toEqual({
      sub: 4, email: 'nuevo@example.invalid', nombre: 'Nombre actualizado', roles: ['MAESTRO'], ver: 0, sid: 'test-session', kind: 'ACCESS',
    });
  });

  it('revoca tokens emitidos antes del último cambio de contraseña', async () => {
    const usuarios = { manager: { getRepository: jest.fn(() => ({ findOne: jest.fn().mockResolvedValue({ version: 0, expiraEn: new Date(Date.now() + 60_000) }) })) },
      findOne: jest.fn().mockResolvedValue({
        id: 4, email: 'demo@example.invalid', nombreCompleto: 'Demo', sessionVersion: 2, roles: [],
      }),
    };
    const strategy = new JwtStrategy(config, usuarios as any, {} as any, {} as any);
    await expect(strategy.validate({ ...payload, ver: 1 })).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rechaza JWT de un expediente de alumno dado de baja', async () => {
    const usuarios = { manager: { getRepository: jest.fn(() => ({ findOne: jest.fn().mockResolvedValue({ version: 0, expiraEn: new Date(Date.now() + 60_000) }) })) }, findOne: jest.fn().mockResolvedValue({
      id: 4, email: 'alumno@example.invalid', nombreCompleto: 'Alumno', sessionVersion: 0,
      roles: [{ clave: 'ALUMNO' }],
    }) };
    const alumnos = { findOne: jest.fn().mockResolvedValue(null) };
    const strategy = new JwtStrategy(config, usuarios as any, alumnos as any, {} as any);

    await expect(strategy.validate(payload)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(alumnos.findOne).toHaveBeenCalledWith({ where: { usuarioId: 4, estatus: 'ACTIVO' } });
  });

  it('rechaza JWT de un expediente docente dado de baja', async () => {
    const usuarios = { manager: { getRepository: jest.fn(() => ({ findOne: jest.fn().mockResolvedValue({ version: 0, expiraEn: new Date(Date.now() + 60_000) }) })) }, findOne: jest.fn().mockResolvedValue({
      id: 4, email: 'maestro@example.invalid', nombreCompleto: 'Maestro', sessionVersion: 0,
      roles: [{ clave: 'MAESTRO' }],
    }) };
    const docentes = { findOne: jest.fn().mockResolvedValue(null) };
    const strategy = new JwtStrategy(config, usuarios as any, {} as any, docentes as any);

    await expect(strategy.validate(payload)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(docentes.findOne).toHaveBeenCalledWith({ where: { usuarioId: 4, estatus: 'ACTIVO' } });
  });
});
