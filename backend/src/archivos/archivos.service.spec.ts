import type { Repository } from 'typeorm';
import type { UsuarioPlantel } from '../entities/usuario-plantel.entity';
import type { Material } from '../entities/material.entity';
import type { Entrega } from '../entities/entrega.entity';
import type { Inscripcion } from '../entities/inscripcion.entity';
import type { Usuario } from '../entities/usuario.entity';
import type { JwtService } from '@nestjs/jwt';
import type { ConfigService } from '@nestjs/config';
import type { TemariosService } from '../temarios/temarios.service';
import type { CalendarioService } from '../calendario/calendario.service';
import type { Response } from 'express';
import { stub } from '../test-utils/stub';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { ArchivosService } from './archivos.service';
import { ScopeService } from '../planteles/scope.service';
import { JwtUser } from '../common/current-user.decorator';

const alumnoUser: JwtUser = {
  sub: 10,
  email: 'alumno@escuela.mx',
  nombre: 'Alumno',
  roles: ['ALUMNO'],
  sid: 'sesion-alumno',
  ver: 0,
};
const maestroUser: JwtUser = {
  sub: 20,
  email: 'maestro@escuela.mx',
  nombre: 'Maestro',
  roles: ['MAESTRO'],
  sid: 'sesion-maestro',
  ver: 0,
};

const materialConGrupo = (grupoId: number, docenteUsuarioId: number | null) => ({
  id: 1,
  archivoNombre: 'guia.pdf',
  archivoRuta: '/uploads/guia.pdf',
  mime: 'application/pdf',
  grupoMateria: {
    docente: docenteUsuarioId ? { usuarioId: docenteUsuarioId } : null,
    grupo: { id: grupoId, plantelId: 1, activo: true, ciclo: { activo: true }, plantel: { activo: true } },
  },
});

const entregaDe = (alumnoUsuarioId: number, docenteUsuarioId: number | null) => ({
  id: 5,
  archivoNombre: 'tarea.pdf',
  archivoRuta: '/uploads/tarea.pdf',
  alumno: { usuarioId: alumnoUsuarioId },
  actividad: {
    grupoMateria: {
      docente: docenteUsuarioId ? { usuarioId: docenteUsuarioId } : null,
      grupo: { id: 3, plantelId: 1, activo: true, ciclo: { activo: true }, plantel: { activo: true } },
    },
  },
});

function crearService(
  overrides: {
    materialesRepo?: { findOne: jest.Mock };
    entregasRepo?: { findOne: jest.Mock };
    inscripcionesRepo?: { createQueryBuilder: jest.Mock; manager?: { getRepository: jest.Mock } };
    usuariosRepo?: { findOne: jest.Mock; manager?: { getRepository: jest.Mock } };
    jwt?: { sign: jest.Mock; verify: jest.Mock };
  } = {},
) {
  const materialesRepo = overrides.materialesRepo ?? { findOne: jest.fn() };
  const entregasRepo = overrides.entregasRepo ?? { findOne: jest.fn() };
  const qb = {
    innerJoin: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getCount: jest.fn().mockResolvedValue(0),
  };
  const inscripcionesRepo: NonNullable<typeof overrides.inscripcionesRepo> = overrides.inscripcionesRepo ?? {
    createQueryBuilder: jest.fn().mockReturnValue(qb),
  };
  inscripcionesRepo.manager = {
    getRepository: jest.fn().mockReturnValue({ createQueryBuilder: jest.fn().mockReturnValue(qb) }),
  };
  const usuariosRepo = overrides.usuariosRepo ?? { findOne: jest.fn() };
  const scope = new ScopeService(stub<Repository<UsuarioPlantel>>({}));
  jest.spyOn(scope, 'validarGestion').mockResolvedValue(null);
  const jwt = overrides.jwt ?? { sign: jest.fn().mockReturnValue('firmado'), verify: jest.fn() };
  const config = { get: jest.fn().mockReturnValue(undefined) };
  const service = new ArchivosService(
    stub<Repository<Material>>(materialesRepo),
    stub<Repository<Entrega>>(entregasRepo),
    stub<Repository<Inscripcion>>(inscripcionesRepo),
    stub<Repository<Usuario>>(usuariosRepo),
    scope,
    stub<JwtService>(jwt),
    stub<ConfigService>(config),
    stub<TemariosService>({}),
    stub<CalendarioService>({}),
  );
  return { service, materialesRepo, entregasRepo, inscripcionesRepo, jwt };
}

describe('ArchivosService', () => {
  it('rechaza a un alumno ajeno al grupo de un material', async () => {
    const { service, materialesRepo } = crearService();
    materialesRepo.findOne.mockResolvedValue(materialConGrupo(7, 99));
    await expect(service.enlaceMaterial(1, alumnoUser)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rechaza a un alumno pidiendo la entrega de otro alumno', async () => {
    const { service, entregasRepo } = crearService();
    entregasRepo.findOne.mockResolvedValue(entregaDe(999, null));
    await expect(service.enlaceEntrega(5, alumnoUser)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('permite al maestro dueño de la clase generar el enlace del material', async () => {
    const { service, materialesRepo } = crearService();
    materialesRepo.findOne.mockResolvedValue(materialConGrupo(7, maestroUser.sub));
    await expect(service.enlaceMaterial(1, maestroUser)).resolves.toMatchObject({
      url: '/api/archivos/materiales/1?t=firmado',
    });
  });

  it('rechaza al maestro dueño si el grupo del material está inactivo', async () => {
    const { service, materialesRepo } = crearService();
    const material = materialConGrupo(7, maestroUser.sub);
    material.grupoMateria.grupo.activo = false;
    materialesRepo.findOne.mockResolvedValue(material);

    await expect(service.enlaceMaterial(1, maestroUser)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rechaza el streaming si el token trae un id distinto al de la ruta', async () => {
    const jwt = { sign: jest.fn(), verify: jest.fn().mockReturnValue({ sub: 10, rec: 'material', id: 999 }) };
    const { service } = crearService({ jwt });
    await expect(
      service.descargarMaterial(1, 'token', stub<Response<unknown, Record<string, unknown>>>({})),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rechaza el streaming con un token expirado', async () => {
    const jwt = {
      sign: jest.fn(),
      verify: jest.fn().mockImplementation(() => {
        throw new Error('jwt expired');
      }),
    };
    const { service } = crearService({ jwt });
    await expect(
      service.descargarMaterial(1, 'token', stub<Response<unknown, Record<string, unknown>>>({})),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
  it.each(['revocada', 'expirada', 'version', 'inactiva', 'activacion-pendiente'])(
    'rechaza enlace firmado con sesión %s',
    async (caso) => {
      const payload = { sub: 20, rec: 'material', id: 1, kind: 'FILE', sid: 'sesion-maestro', ver: 0 };
      const usuario = {
        id: 20,
        activo: true,
        activacionPendiente: caso === 'activacion-pendiente',
        sessionVersion: caso === 'version' ? 1 : 0,
        roles: [{ clave: 'MAESTRO' }],
      };
      const sesiones = {
        findOne: jest
          .fn()
          .mockResolvedValue(
            caso === 'revocada'
              ? null
              : {
                  version: 0,
                  ultimaActividadEn: new Date(caso === 'inactiva' ? Date.now() - 1800000 : Date.now()),
                  expiraEn: new Date(caso === 'expirada' ? 0 : Date.now() + 60000),
                },
          ),
      };
      const usuariosRepo = {
        findOne: jest.fn().mockResolvedValue(usuario),
        manager: { getRepository: jest.fn().mockReturnValue(sesiones) },
      };
      const jwt = { sign: jest.fn(), verify: jest.fn().mockReturnValue(payload) };
      const { service, materialesRepo } = crearService({ usuariosRepo, jwt });
      materialesRepo.findOne.mockResolvedValue(materialConGrupo(7, 20));
      await expect(
        service.descargarMaterial(1, 'firmado', stub<Response<unknown, Record<string, unknown>>>({})),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    },
  );
  it('el maestro no obtiene materiales de ciclos cerrados', async () => {
    const { service, materialesRepo } = crearService();
    const material = materialConGrupo(7, 20);
    material.grupoMateria.grupo.ciclo.activo = false;
    materialesRepo.findOne.mockResolvedValue(material);
    await expect(service.enlaceMaterial(1, maestroUser)).rejects.toBeInstanceOf(ForbiddenException);
  });
});
