import * as bcrypt from 'bcryptjs';
import { createHash } from 'crypto';
import { UnauthorizedException } from '@nestjs/common';
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
    const bitacora = { insert: jest.fn().mockResolvedValue(undefined) };
    const jwt = { sign: jest.fn().mockReturnValue('token') };
    const config = { get: jest.fn((key: string) => (key === 'JWT_EXPIRES_MOVIL' ? '30d' : '8h')) };
    const service = new AuthService(repo as any, {} as any, bitacora as any, jwt as any, {} as any, config as any);
    return { service, jwt, bitacora, repo };
  };

  it('rechaza alumno en portal WEB', async () => {
    const { service } = await crear(['ALUMNO']);
    await expect(service.login('demo@escuela.mx', 'Correcta123', 'WEB')).rejects.toThrow(
      'Tu cuenta es de alumno. Ingresa desde la app móvil de la escuela.',
    );
  });

  it('rechaza personal en portal MOVIL', async () => {
    const { service } = await crear(['ADMINISTRATIVO']);
    await expect(service.login('demo@escuela.mx', 'Correcta123', 'MOVIL')).rejects.toThrow(
      'Esta app es solo para alumnos. El personal ingresa por el portal web.',
    );
  });

  it('firma token en caso feliz', async () => {
    const { service, jwt } = await crear(['ADMINISTRATIVO']);
    await expect(service.login('demo@escuela.mx', 'Correcta123', 'WEB')).resolves.toMatchObject({ accessToken: 'token' });
    expect(jwt.sign).toHaveBeenCalledWith(expect.objectContaining({ roles: ['ADMINISTRATIVO'] }), { expiresIn: '8h' });
  });

  it('permite alumno en MOVIL', async () => {
    const { service } = await crear(['ALUMNO']);
    await expect(service.login('demo@escuela.mx', 'Correcta123', 'MOVIL')).resolves.toMatchObject({ accessToken: 'token' });
  });

  it('registra el intento fallido en la bitácora con contraseña incorrecta', async () => {
    const { service, bitacora } = await crear(['ALUMNO']);
    await expect(service.login('demo@escuela.mx', 'Incorrecta', 'MOVIL', '10.0.0.1')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(bitacora.insert).toHaveBeenCalledWith(
      expect.objectContaining({ usuarioId: 1, metodo: 'POST', ruta: 'auth/login:FALLIDO', ip: '10.0.0.1' }),
    );
  });

  it('registra PORTAL_RECHAZADO cuando el rol no corresponde al portal', async () => {
    const { service, bitacora } = await crear(['ALUMNO']);
    await expect(service.login('demo@escuela.mx', 'Correcta123', 'WEB')).rejects.toThrow();
    expect(bitacora.insert).toHaveBeenCalledWith(
      expect.objectContaining({ usuarioId: 1, ruta: 'auth/login:PORTAL_RECHAZADO' }),
    );
  });

  it('la bitácora nunca tumba el login aunque falle el insert', async () => {
    const { service, bitacora } = await crear(['ALUMNO']);
    bitacora.insert.mockRejectedValue(new Error('bd caída'));
    await expect(service.login('demo@escuela.mx', 'Correcta123', 'MOVIL')).resolves.toMatchObject({ accessToken: 'token' });
  });
});

describe('AuthService.forgotPassword / resetPassword', () => {
  const crear = () => {
    const usuarios = { findOne: jest.fn(), update: jest.fn().mockResolvedValue(undefined) };
    const tokens = {
      update: jest.fn().mockResolvedValue(undefined),
      save: jest.fn((t) => Promise.resolve(t)),
      create: jest.fn((t) => t),
      findOne: jest.fn(),
    };
    const notificaciones = { enviarEmail: jest.fn().mockResolvedValue(undefined) };
    const service = new AuthService(usuarios as any, tokens as any, {} as any, {} as any, notificaciones as any, {} as any);
    return { service, usuarios, tokens, notificaciones };
  };

  it('guarda el hash del token (sha256, 64 hex), no el valor en claro', async () => {
    const { service, usuarios, tokens, notificaciones } = crear();
    usuarios.findOne.mockResolvedValue({ id: 1, email: 'demo@escuela.mx', nombre: 'Demo' });

    await service.forgotPassword('demo@escuela.mx');

    expect(tokens.save).toHaveBeenCalledTimes(1);
    const guardado = tokens.save.mock.calls[0][0];
    const tokenEnClaro = notificaciones.enviarEmail.mock.calls[0][2].match(/<b>(.*)<\/b>/)?.[1];
    expect(guardado.token).toMatch(/^[0-9a-f]{64}$/);
    expect(guardado.token).not.toBe(tokenEnClaro);
    expect(guardado.token).toBe(createHash('sha256').update(tokenEnClaro).digest('hex'));
  });

  it('resetPassword acepta el token original aunque solo se persista su hash', async () => {
    const { service, usuarios, tokens } = crear();
    const tokenOriginal = 'abc123def456';
    const hash = createHash('sha256').update(tokenOriginal).digest('hex');
    tokens.findOne.mockResolvedValue({ id: 9, usuarioId: 1, expiraEn: new Date(Date.now() + 60_000) });

    await service.resetPassword(tokenOriginal, 'NuevaClave123');

    expect(tokens.findOne).toHaveBeenCalledWith({ where: { token: hash, usado: false } });
    expect(usuarios.update).toHaveBeenCalledWith(1, expect.objectContaining({ passwordHash: expect.any(String) }));
    expect(tokens.update).toHaveBeenCalledWith(9, { usado: true });
  });
});
