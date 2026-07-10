import * as bcrypt from 'bcryptjs';
import { ForbiddenException } from '@nestjs/common';
import { AuthService } from './auth.service';

const usuario = async (roles: string[]) => ({
  id: 1,
  email: 'demo@escuela.mx',
  passwordHash: await bcrypt.hash('Correcta123', 4),
  nombreCompleto: 'Demo Usuario',
  roles: roles.map((clave) => ({ clave })),
});

describe('AuthService.login', () => {
  const crear = async (roles: string[]) => {
    const repo = { findOne: jest.fn().mockResolvedValue(await usuario(roles)) };
    const jwt = { sign: jest.fn().mockReturnValue('token') };
    const config = { get: jest.fn((key: string) => (key === 'JWT_EXPIRES_MOVIL' ? '30d' : '8h')) };
    const service = new AuthService(repo as any, {} as any, jwt as any, {} as any, config as any);
    return { service, jwt };
  };

  it('rechaza alumno en portal WEB', async () => {
    const { service } = await crear(['ALUMNO']);
    await expect(service.login('demo@escuela.mx', 'Correcta123', 'WEB')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rechaza personal en portal MOVIL', async () => {
    const { service } = await crear(['ADMINISTRATIVO']);
    await expect(service.login('demo@escuela.mx', 'Correcta123', 'MOVIL')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('firma token en caso feliz', async () => {
    const { service, jwt } = await crear(['ADMINISTRATIVO']);
    await expect(service.login('demo@escuela.mx', 'Correcta123', 'WEB')).resolves.toMatchObject({ accessToken: 'token' });
    expect(jwt.sign).toHaveBeenCalledWith(expect.objectContaining({ roles: ['ADMINISTRATIVO'] }), { expiresIn: '8h' });
  });
});
