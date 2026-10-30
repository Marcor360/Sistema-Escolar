import type { Repository, DataSource } from 'typeorm';
import type { Usuario } from '../entities/usuario.entity';
import type { PasswordResetToken } from '../entities/password-reset-token.entity';
import type { BitacoraActividad } from '../entities/bitacora-actividad.entity';
import type { JwtService } from '@nestjs/jwt';
import type { CorreoAccesoOutboxService } from './correo-acceso-outbox.service';
import type { ConfigService } from '@nestjs/config';
import { stub } from '../test-utils/stub';
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
    const sessions = {
      create: jest.fn().mockImplementation((s: Record<string, unknown>) => s),
      save: jest.fn(async (s) => s),
      findOne: jest.fn().mockResolvedValue({ id: 1 }),
    };
    const source = { getRepository: jest.fn(() => sessions) };
    const service = new AuthService(
      stub<Repository<Usuario>>(repo),
      stub<Repository<PasswordResetToken>>({}),
      stub<Repository<BitacoraActividad>>(bitacora),
      stub<JwtService>(jwt),
      stub<CorreoAccesoOutboxService>({}),
      stub<ConfigService>(config),
      stub<DataSource>(source),
    );
    return { service, jwt, bitacora, repo, sessions };
  };

  it('rechaza alumno en portal WEB', async () => {
    const { service } = await crear(['ALUMNO']);
    await expect(service.login('demo@escuela.mx', 'Correcta123', 'WEB')).rejects.toThrow(
      'Tu cuenta es de alumno. Ingresa al Portal Alumno de la escuela.',
    );
  });

  it('rechaza personal en portal MOVIL', async () => {
    const { service } = await crear(['ADMINISTRATIVO']);
    await expect(service.login('demo@escuela.mx', 'Correcta123', 'MOVIL')).rejects.toThrow(
      'Esta app es solo para alumnos. El personal ingresa por el portal web.',
    );
  });

  it('rechaza cuenta pendiente aunque la contraseña sea correcta', async () => {
    const { service, repo, jwt } = await crear(['ADMINISTRATIVO']);
    repo.findOne.mockResolvedValue({ ...(await usuario(['ADMINISTRATIVO'])), activacionPendiente: true } as never);
    await expect(service.login('demo@escuela.mx', 'Correcta123', 'WEB')).rejects.toThrow('necesita activación');
    expect(jwt.sign).not.toHaveBeenCalled();
  });

  it('firma token en caso feliz', async () => {
    const { service, jwt, repo } = await crear(['ADMINISTRATIVO']);
    const respuesta = await service.login('demo@escuela.mx', 'Correcta123', 'WEB');
    expect(respuesta).toMatchObject({ accessToken: 'token' });
    expect(JSON.stringify(respuesta)).not.toContain('passwordHash');
    expect(jwt.sign).toHaveBeenCalledWith(expect.objectContaining({ roles: ['ADMINISTRATIVO'] }), { expiresIn: '15m' });
    expect(repo.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.arrayContaining(['passwordHash', 'segundoNombre']),
      }),
    );
  });

  it('persiste la actividad inicial sin milisegundos para MySQL DATETIME', async () => {
    const { service, sessions } = await crear(['ADMINISTRATIVO']);
    await service.login('demo@escuela.mx', 'Correcta123', 'WEB');
    expect(sessions.create.mock.calls[0][0].ultimaActividadEn.getMilliseconds()).toBe(0);
  });

  it('permite alumno en MOVIL', async () => {
    const { service } = await crear(['ALUMNO']);
    await expect(service.login('demo@escuela.mx', 'Correcta123', 'MOVIL')).resolves.toMatchObject({
      accessToken: 'token',
    });
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
    await expect(service.login('demo@escuela.mx', 'Correcta123', 'MOVIL')).resolves.toMatchObject({
      accessToken: 'token',
    });
  });

  it('me devuelve solo los campos de perfil aunque el repositorio incluya el hash', async () => {
    const repo = {
      findOne: jest.fn().mockResolvedValue({
        id: 1,
        email: 'demo@escuela.mx',
        passwordHash: 'hash-privado',
        nombre: 'Demo',
        apellidoPaterno: 'Usuario',
        apellidoMaterno: null,
        telefono: null,
        activo: true,
        roles: [{ id: 1, clave: 'ADMINISTRATIVO', nombre: 'Administrativo' }],
      }),
    };
    const service = new AuthService(
      stub<Repository<Usuario>>(repo),
      stub<Repository<PasswordResetToken>>({}),
      stub<Repository<BitacoraActividad>>({}),
      stub<JwtService>({}),
      stub<CorreoAccesoOutboxService>({}),
      stub<ConfigService>({}),
      stub<DataSource>({}),
    );

    const respuesta = await service.me({
      sub: 1,
      email: 'demo@escuela.mx',
      nombre: 'Demo Usuario',
      roles: ['ADMINISTRATIVO'],
    });

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
      create: jest.fn().mockImplementation((t: Record<string, unknown>) => t),
      findOne: jest.fn(),
    };
    const notificaciones = { solicitar: jest.fn().mockResolvedValue(undefined) };
    const manager = {
      getRepository: jest.fn((entity) =>
        entity.name === 'Usuario'
          ? {
              findOne: jest.fn().mockResolvedValue({ id: 1, activo: true, passwordHash: 'hash', sessionVersion: 0 }),
              save: jest.fn().mockResolvedValue(undefined),
              update: jest.fn().mockResolvedValue({ affected: 1 }),
            }
          : {
              save: tokens.save,
              create: tokens.create,
              createQueryBuilder: jest.fn(() => ({
                update: jest.fn().mockReturnThis(),
                set: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                execute: jest.fn().mockResolvedValue({ affected: 1 }),
              })),
              update: jest.fn().mockResolvedValue({ affected: 1 }),
            },
      ),
    };
    const dataSource = { transaction: jest.fn((callback) => callback(manager)) };
    const service = new AuthService(
      stub<Repository<Usuario>>(usuarios),
      stub<Repository<PasswordResetToken>>(tokens),
      stub<Repository<BitacoraActividad>>({}),
      stub<JwtService>({}),
      stub<CorreoAccesoOutboxService>(notificaciones),
      stub<ConfigService>({}),
      stub<DataSource>(dataSource),
    );
    return { service, usuarios, tokens, notificaciones, dataSource };
  };

  it('persiste la solicitud sin esperar SMTP ni emitir tokens en HTTP', async () => {
    const outbox = { solicitar: jest.fn().mockResolvedValue(undefined) };
    const service = new AuthService(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      outbox as never,
      {} as never,
      {} as never,
    );
    const respuesta = await service.forgotPassword('demo@escuela.mx');
    expect(outbox.solicitar).toHaveBeenCalledWith('demo@escuela.mx', 'RECUPERACION');
    expect(respuesta.mensaje).toContain('Si la cuenta existe');
  });
  it('no afirma que se recibió una solicitud si falla el commit duradero', async () => {
    const outbox = { solicitar: jest.fn().mockRejectedValue(new Error('BD no disponible')) };
    const service = new AuthService(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      outbox as never,
      {} as never,
      {} as never,
    );
    await expect(service.forgotPassword('demo@escuela.mx')).rejects.toThrow('BD no disponible');
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

describe('AuthService.logout', () => {
  it('incrementa la versión solo para el usuario y token actuales', async () => {
    const usuarios = { increment: jest.fn().mockResolvedValue({ affected: 1 }) };
    const service = new AuthService(
      stub<Repository<Usuario>>(usuarios),
      stub<Repository<PasswordResetToken>>({}),
      stub<Repository<BitacoraActividad>>({}),
      stub<JwtService>({}),
      stub<CorreoAccesoOutboxService>({}),
      stub<ConfigService>({}),
      stub<DataSource>({}),
    );

    await expect(
      service.logout({ sub: 7, ver: 3, email: 'demo@example.invalid', nombre: 'Demo', roles: ['ALUMNO'] }),
    ).resolves.toEqual({ mensaje: 'Sesión cerrada' });
    expect(usuarios.increment).toHaveBeenCalledWith({ id: 7, activo: true, sessionVersion: 3 }, 'sessionVersion', 1);
  });

  it('rechaza un logout repetido de un token revocado', async () => {
    const usuarios = { increment: jest.fn().mockResolvedValue({ affected: 0 }) };
    const service = new AuthService(
      stub<Repository<Usuario>>(usuarios),
      stub<Repository<PasswordResetToken>>({}),
      stub<Repository<BitacoraActividad>>({}),
      stub<JwtService>({}),
      stub<CorreoAccesoOutboxService>({}),
      stub<ConfigService>({}),
      stub<DataSource>({}),
    );

    await expect(
      service.logout({ sub: 7, ver: 3, email: 'demo@example.invalid', nombre: 'Demo', roles: ['ALUMNO'] }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
