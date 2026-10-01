import { UnauthorizedException } from '@nestjs/common';
import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy.validate', () => {
  const config = { get: jest.fn(() => 'test-secret') } as any;
  const payload = { sub: 4, email: 'old@example.invalid', nombre: 'Nombre anterior', roles: ['ADMINISTRATIVO'] };

  it('rechaza tokens de usuarios desactivados o eliminados', async () => {
    const usuarios = { findOne: jest.fn().mockResolvedValue(null) };
    const strategy = new JwtStrategy(config, usuarios as any);
    await expect(strategy.validate(payload)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(usuarios.findOne).toHaveBeenCalledWith({ where: { id: 4, activo: true } });
  });

  it('carga correo, nombre y roles vigentes desde la base', async () => {
    const usuarios = {
      findOne: jest.fn().mockResolvedValue({
        id: 4, email: 'nuevo@example.invalid', nombreCompleto: 'Nombre actualizado',
        roles: [{ clave: 'MAESTRO' }],
      }),
    };
    const strategy = new JwtStrategy(config, usuarios as any);
    await expect(strategy.validate(payload)).resolves.toEqual({
      sub: 4, email: 'nuevo@example.invalid', nombre: 'Nombre actualizado', roles: ['MAESTRO'], ver: 0,
    });
  });

  it('revoca tokens emitidos antes del último cambio de contraseña', async () => {
    const usuarios = {
      findOne: jest.fn().mockResolvedValue({
        id: 4, email: 'demo@example.invalid', nombreCompleto: 'Demo', sessionVersion: 2, roles: [],
      }),
    };
    const strategy = new JwtStrategy(config, usuarios as any);
    await expect(strategy.validate({ ...payload, ver: 1 })).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
