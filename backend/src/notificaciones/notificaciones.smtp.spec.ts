import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import * as nodemailer from 'nodemailer';
import { NotificacionesService } from './notificaciones.service';
import { Notificacion } from '../entities/notificacion.entity';
import { Usuario } from '../entities/usuario.entity';
import { Alumno } from '../entities/alumno.entity';
import { UsuarioPlantel } from '../entities/usuario-plantel.entity';
import { ScopeService } from '../planteles/scope.service';

jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({ sendMail: jest.fn() })),
}));

describe('SMTP seguro en entornos desplegados', () => {
  const crear = (port: string, env: string, appEnv?: string) => {
    const valores: Record<string, string> = {
      SMTP_HOST: 'smtp.example.test',
      SMTP_PORT: port,
      SMTP_FROM: 'noreply@example.test',
      SMTP_USER: 'test-user',
      SMTP_PASS: 'test-password',
      NODE_ENV: env,
      ...(appEnv ? { APP_ENV: appEnv } : {}),
    };
    const config = { get: (clave: string) => valores[clave] } as ConfigService;
    const repo = {} as Repository<Notificacion>;
    const usuarios = {} as Repository<Usuario>;
    const alumnos = {} as Repository<Alumno>;
    const asignaciones = {} as Repository<UsuarioPlantel>;
    const scope = {} as ScopeService;
    return new NotificacionesService(repo, usuarios, alumnos, asignaciones, scope, config);
  };

  beforeEach(() => jest.clearAllMocks());

  it.each(['0', '-1', '65536', 'abc', '587abc', 'NaN'])(
    'rechaza SMTP_PORT mal configurado: %s',
    (puerto) => {
      expect(() => crear(puerto, 'production')).toThrow('SMTP_PORT debe ser un puerto valido');
      expect(nodemailer.createTransport).not.toHaveBeenCalled();
    },
  );



  it.each<[string, string, string | undefined, boolean, boolean]>([
    ['587', 'production', undefined, true, false],
    ['587', 'development', 'staging', true, false],
    ['587', 'development', undefined, false, false],
    ['465', 'production', undefined, false, true],
  ])('puerto %s, entorno %s, APP_ENV %s', (port, env, appEnv, requireTLS, secure) => {
    crear(port, env, appEnv);
    expect(nodemailer.createTransport).toHaveBeenCalledWith(expect.objectContaining({
      requireTLS,
      secure,
      tls: { rejectUnauthorized: true },
    }));
  });
});
