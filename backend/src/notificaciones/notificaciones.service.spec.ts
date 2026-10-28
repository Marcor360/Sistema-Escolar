import type { Repository } from 'typeorm';
import type { Notificacion } from '../entities/notificacion.entity';
import type { Usuario } from '../entities/usuario.entity';
import type { Alumno } from '../entities/alumno.entity';
import type { UsuarioPlantel } from '../entities/usuario-plantel.entity';
import type { ScopeService } from '../planteles/scope.service';
import type { ConfigService } from '@nestjs/config';
import type { JwtUser } from '../common/current-user.decorator';
import { stub } from '../test-utils/stub';
import { ForbiddenException } from '@nestjs/common';
import { NotificacionesService } from './notificaciones.service';

const admin = { sub: 4, email: 'admin@example.invalid', nombre: 'Admin', roles: ['ADMINISTRATIVO'] };

describe('NotificacionesService.difundir alcance', () => {
  it('rechaza destinatarios explícitos asignados a otro plantel', async () => {
    const repo = { insert: jest.fn() };
    const usuarios = { createQueryBuilder: jest.fn() };
    const alumnos = { find: jest.fn().mockResolvedValue([]) };
    const asignaciones = { find: jest.fn().mockResolvedValue([]) };
    const scope = { plantelesDe: jest.fn().mockResolvedValue([1]) };
    const service = new NotificacionesService(
      stub<Repository<Notificacion>>(repo),
      stub<Repository<Usuario>>(usuarios),
      stub<Repository<Alumno>>(alumnos),
      stub<Repository<UsuarioPlantel>>(asignaciones),
      stub<ScopeService>(scope),
      stub<ConfigService>({ get: jest.fn().mockReturnValue(undefined) }),
    );

    await expect(
      service.difundir('Aviso', 'Mensaje', { usuarioIds: [20] }, stub<JwtUser>(admin)),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(repo.insert).not.toHaveBeenCalled();
  });

  it('limita difusión por rol a destinatarios de los planteles asignados', async () => {
    const query = {
      innerJoin: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([{ id: 20 }, { id: 21 }]),
    };
    const repo = {
      create: jest.fn().mockImplementation((dato: Record<string, unknown>) => dato),
      save: jest.fn().mockResolvedValue({ id: 1, usuarioId: 20 }),
    };
    const usuarios = { createQueryBuilder: jest.fn().mockReturnValue(query) };
    const alumnos = { find: jest.fn().mockResolvedValue([{ usuarioId: 20 }]) };
    const asignaciones = { find: jest.fn().mockResolvedValue([]) };
    const scope = { plantelesDe: jest.fn().mockResolvedValue([1]) };
    const service = new NotificacionesService(
      stub<Repository<Notificacion>>(repo),
      stub<Repository<Usuario>>(usuarios),
      stub<Repository<Alumno>>(alumnos),
      stub<Repository<UsuarioPlantel>>(asignaciones),
      stub<ScopeService>(scope),
      stub<ConfigService>({ get: jest.fn().mockReturnValue(undefined) }),
    );

    await expect(service.difundir('Aviso', 'Mensaje', { rol: 'ALUMNO' }, stub<JwtUser>(admin))).resolves.toEqual({
      enviadas: 1,
    });
    expect(repo.create).toHaveBeenCalledWith({
      usuarioId: 20,
      titulo: 'Aviso',
      mensaje: 'Mensaje',
      tipo: 'GENERAL',
      pushPendiente: true,
    });
    expect(repo.save).toHaveBeenCalledTimes(1);
  });
});

describe('NotificacionesService configuración de correo', () => {
  const dependencias = [
    stub<Repository<Notificacion>>({}),
    stub<Repository<Usuario>>({}),
    stub<Repository<Alumno>>({}),
    stub<Repository<UsuarioPlantel>>({}),
    stub<ScopeService>({}),
  ] as const;

  it('exige SMTP completo en producción', () => {
    const service = () =>
      new NotificacionesService(
        ...dependencias,
        stub<ConfigService>({ get: (key: string) => (key === 'NODE_ENV' ? 'production' : undefined) }),
      );

    expect(service).toThrow('SMTP_HOST, SMTP_USER, SMTP_PASS y SMTP_FROM');
  });

  it('acepta credenciales SMTP completas en producción', () => {
    const values: Record<string, string> = {
      NODE_ENV: 'production',
      SMTP_HOST: 'smtp.example.mx',
      SMTP_USER: 'app',
      SMTP_PASS: 'secret',
      SMTP_FROM: 'Colegio <no-reply@example.mx>',
      SMTP_PORT: '587',
    };
    expect(
      () => new NotificacionesService(...dependencias, stub<ConfigService>({ get: (key: string) => values[key] })),
    ).not.toThrow();
  });

  it('permite SMTP pendiente en staging con Node en modo producción', () => {
    const values: Record<string, string> = { NODE_ENV: 'production', APP_ENV: 'staging' };
    expect(
      () => new NotificacionesService(...dependencias, stub<ConfigService>({ get: (key: string) => values[key] })),
    ).not.toThrow();
  });
});
