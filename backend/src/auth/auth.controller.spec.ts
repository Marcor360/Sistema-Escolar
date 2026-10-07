import type { Request, Response } from 'express';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('Refresh web aislado de JavaScript', () => {
  const tokens = { accessToken: 'acceso', refreshToken: 'refresh-secreto', usuario: { sub: 1 } };
  const login = jest.fn().mockResolvedValue(tokens);
  const refresh = jest.fn().mockResolvedValue(tokens);
  const controller = new AuthController({ login, refresh } as unknown as AuthService);
  const cookie = jest.fn();
  const res = { cookie } as unknown as Response;
  const origenAnterior = process.env.CORS_ORIGINS;
  beforeEach(() => { jest.clearAllMocks(); process.env.CORS_ORIGINS = 'https://escolar.example.invalid'; });
  afterAll(() => { if (origenAnterior === undefined) delete process.env.CORS_ORIGINS; else process.env.CORS_ORIGINS = origenAnterior; });

  it('web no devuelve refresh en JSON y usa cookie HttpOnly', async () => {
    const resultado = await controller.login({ email: 'qa@example.invalid', password: 'temporal' }, 'WEB', '127.0.0.1', res);
    expect(resultado).toEqual({ accessToken: 'acceso', usuario: tokens.usuario });
    expect(cookie).toHaveBeenCalledWith('escolar_refresh', 'refresh-secreto', expect.objectContaining({ httpOnly: true, sameSite: 'strict', path: '/api/auth' }));
  });
  it('móvil recibe refresh para SecureStore y no crea cookie', async () => {
    expect(await controller.login({ email: 'qa@example.invalid', password: 'temporal' }, 'MOVIL', '127.0.0.1', res)).toEqual(tokens);
    expect(cookie).not.toHaveBeenCalled();
  });
  it('rechaza renovar web desde un origen ajeno', async () => {
    await expect(controller.refresh({}, 'WEB', { headers: { origin: 'https://ajeno.invalid', cookie: 'escolar_refresh=secreto' } } as unknown as Request, res)).rejects.toThrow('Origen no autorizado');
    expect(refresh).not.toHaveBeenCalled();
  });
  it('web usa la cookie e ignora el token enviado en cuerpo', async () => {
    await controller.refresh({ refreshToken: 'cuerpo-invalido' }, 'WEB', { headers: { origin: 'https://escolar.example.invalid', cookie: 'otra=1; escolar_refresh=cookie-valida' } } as unknown as Request, res);
    expect(refresh).toHaveBeenCalledWith('cookie-valida', 'WEB');
  });
});
