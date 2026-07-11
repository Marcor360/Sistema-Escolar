import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { ArchivosService } from './archivos.service';
import { ScopeService } from '../planteles/scope.service';
import { JwtUser } from '../common/current-user.decorator';

const alumnoUser: JwtUser = { sub: 10, email: 'alumno@escuela.mx', nombre: 'Alumno', roles: ['ALUMNO'] };
const maestroUser: JwtUser = { sub: 20, email: 'maestro@escuela.mx', nombre: 'Maestro', roles: ['MAESTRO'] };

const materialConGrupo = (grupoId: number, docenteUsuarioId: number | null) => ({
  id: 1,
  archivoNombre: 'guia.pdf',
  archivoRuta: '/uploads/guia.pdf',
  mime: 'application/pdf',
  grupoMateria: {
    docente: docenteUsuarioId ? { usuarioId: docenteUsuarioId } : null,
    grupo: { id: grupoId, plantelId: 1 },
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
      grupo: { id: 3, plantelId: 1 },
    },
  },
});

function crearService(overrides: {
  materialesRepo?: any; entregasRepo?: any; inscripcionesRepo?: any; usuariosRepo?: any; jwt?: any;
} = {}) {
  const materialesRepo = overrides.materialesRepo ?? { findOne: jest.fn() };
  const entregasRepo = overrides.entregasRepo ?? { findOne: jest.fn() };
  const qb = { where: jest.fn().mockReturnThis(), andWhere: jest.fn().mockReturnThis(), getCount: jest.fn().mockResolvedValue(0) };
  const inscripcionesRepo = overrides.inscripcionesRepo ?? { createQueryBuilder: jest.fn().mockReturnValue(qb) };
  const usuariosRepo = overrides.usuariosRepo ?? { findOne: jest.fn() };
  const scope = new ScopeService({} as any);
  jest.spyOn(scope, 'validarGestion').mockResolvedValue(null as any);
  const jwt = overrides.jwt ?? { sign: jest.fn().mockReturnValue('firmado'), verify: jest.fn() };
  const config = { get: jest.fn().mockReturnValue(undefined) };
  const service = new ArchivosService(
    materialesRepo as any, entregasRepo as any, inscripcionesRepo as any, usuariosRepo as any,
    scope, jwt as any, config as any,
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

  it('rechaza el streaming si el token trae un id distinto al de la ruta', async () => {
    const jwt = { sign: jest.fn(), verify: jest.fn().mockReturnValue({ sub: 10, rec: 'material', id: 999 }) };
    const { service } = crearService({ jwt });
    await expect(service.descargarMaterial(1, 'token', {} as any)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rechaza el streaming con un token expirado', async () => {
    const jwt = { sign: jest.fn(), verify: jest.fn().mockImplementation(() => { throw new Error('jwt expired'); }) };
    const { service } = crearService({ jwt });
    await expect(service.descargarMaterial(1, 'token', {} as any)).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
