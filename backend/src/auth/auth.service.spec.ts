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
    const service = new AuthService(repo as any, {} as any, bitacora as any, jwt as any, {} as any, config as any, {} as any);
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
    const { service, jwt, repo } = await crear(['ADMINISTRATIVO']);
    const respuesta = await service.login('demo@escuela.mx', 'Correcta123', 'WEB');
    expect(respuesta).toMatchObject({ accessToken: 'token' });
    expect(JSON.stringify(respuesta)).not.toContain('passwordHash');
    expect(jwt.sign).toHaveBeenCalledWith(expect.objectContaining({ roles: ['ADMINISTRATIVO'] }), { expiresIn: '8h' });
    expect(repo.findOne).toHaveBeenCalledWith(expect.objectContaining({
      select: expect.arrayContaining(['passwordHash']),
    }));
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

  it('me devuelve solo los campos de perfil aunque el repositorio incluya el hash', async () => {
    const repo = { findOne: jest.fn().mockResolvedValue({
      id: 1, email: 'demo@escuela.mx', passwordHash: 'hash-privado', nombre: 'Demo',
      apellidoPaterno: 'Usuario', apellidoMaterno: null, telefono: null, activo: true,
      roles: [{ id: 1, clave: 'ADMINISTRATIVO', nombre: 'Administrativo' }],
    }) };
    const service = new AuthService(repo as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any);

    const respuesta = await service.me({ sub: 1, email: 'demo@escuela.mx', nombre: 'Demo Usuario', roles: ['ADMINISTRATIVO'] });

    expect(JSON.stringify(respuesta)).not.toContain('hash-privado');
    expect(respuesta).not.toHaveProperty('passwordHash');
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
    const manager = {
      getRepository: jest.fn((entity) => entity.name === 'Usuario'
        ? {
          findOne: jest.fn().mockResolvedValue({ id: 1, activo: true, passwordHash: 'hash', sessionVersion: 0 }),
          save: jest.fn().mockResolvedValue(undefined),
          update: jest.fn().mockResolvedValue({ affected: 1 }),
        }
        : {
          createQueryBuilder: jest.fn(() => ({
            update: jest.fn().mockReturnThis(),
            set: jest.fn().mockReturnThis(),
            where: jest.fn().mockReturnThis(),
            execute: jest.fn().mockResolvedValue({ affected: 1 }),
          })),
          update: jest.fn().mockResolvedValue({ affected: 1 }),
        }),
    };
    const dataSource = { transaction: jest.fn((callback) => callback(manager)) };
    const service = new AuthService(
      usuarios as any, tokens as any, {} as any, {} as any, notificaciones as any, {} as any, dataSource as any,
    );
    return { service, usuarios, tokens, notificaciones, dataSource };
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
    const { service, tokens, dataSource } = crear();
    const tokenOriginal = 'abc123def456';
    const hash = createHash('sha256').update(tokenOriginal).digest('hex');
    tokens.findOne.mockResolvedValue({ id: 9, usuarioId: 1, expiraEn: new Date(Date.now() + 60_000) });

    await service.resetPassword(tokenOriginal, 'NuevaClave123');

    expect(tokens.findOne).toHaveBeenCalledWith({ where: { token: hash, usado: false } });
    expect(dataSource.transaction).toHaveBeenCalledTimes(1);
  });
});
