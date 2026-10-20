import { DataSource, EntityManager, Repository } from 'typeorm';
import { Alumno } from '../entities/alumno.entity';
import { Grupo } from '../entities/grupo.entity';
import { Inscripcion } from '../entities/inscripcion.entity';
import { CupoRecursamiento } from '../entities/participacion-asignatura.entity';
import { BitacoraAcademica } from '../entities/bitacora-academica.entity';
import { JwtUser } from '../common/current-user.decorator';
import { ScopeService } from '../planteles/scope.service';
import { GruposService } from './grupos.service';
import { InscripcionesService } from './inscripciones.service';

function prepararInscripcion(ocupados: number) {
  const grupos = { findOne: jest.fn().mockResolvedValue({
    id: 9, plantelId: 2, cicloId: 3, activo: true, tipo: 'REGULAR',
    ciclo: { estado: 'ACTIVO' }, plantel: { activo: true },
  }) };
  const alumnos = { findOne: jest.fn().mockResolvedValue({
    id: 10, plantelId: 2, estatus: 'ACTIVO', usuario: { activo: true },
  }) };
  const inscripciones = {
    findOne: jest.fn().mockResolvedValue(null),
    findOneBy: jest.fn().mockResolvedValue(null),
    countBy: jest.fn().mockResolvedValue(ocupados),
    create: jest.fn((datos: object) => datos),
    save: jest.fn().mockResolvedValue({ id: 11, grupoId: 9, alumnoId: 10 }),
  };
  const cupos = { find: jest.fn().mockResolvedValue([]) };
  const bitacora = { insert: jest.fn().mockResolvedValue({}) };
  const manager = {
    getRepository: jest.fn((entidad: { name: string }) => {
      if (entidad === Grupo) return grupos;
      if (entidad === Alumno) return alumnos;
      if (entidad === Inscripcion) return inscripciones;
      if (entidad === CupoRecursamiento) return cupos;
      if (entidad === BitacoraAcademica) return bitacora;
      throw new Error('Entidad inesperada en prueba');
    }),
  } as unknown as EntityManager;
  const dataSource = {
    transaction: (operacion: (transaccion: EntityManager) => Promise<unknown>) => operacion(manager),
  } as unknown as DataSource;
  const scope = { validarGestion: jest.fn().mockResolvedValue(undefined) } as unknown as ScopeService;
  const servicio = new InscripcionesService(
    grupos as unknown as Repository<Grupo>,
    inscripciones as unknown as Repository<Inscripcion>,
    scope,
    dataSource,
    {} as GruposService,
  );
  const actor = { sub: 1, roles: ['ADMINISTRATIVO'] } as JwtUser;
  return { servicio, actor, inscripciones, bitacora };
}

describe('InscripcionesService: cupo regular directo', () => {
  it.each([50, 51, 54])('impide altas directas con %i inscritos', async (ocupados) => {
    const { servicio, actor, inscripciones } = prepararInscripcion(ocupados);
    await expect(servicio.inscribirAlumno(9, 10, actor)).rejects.toThrow('cupo de inscripción directa');
    expect(inscripciones.save).not.toHaveBeenCalled();
  });

  it('permite la inscripción directa por debajo de 50 sin rebasar las reservas', async () => {
    const { servicio, actor, inscripciones, bitacora } = prepararInscripcion(49);
    await expect(servicio.inscribirAlumno(9, 10, actor)).resolves.toMatchObject({
      grupoId: 9, alumnoId: 10,
    });
    expect(inscripciones.save).toHaveBeenCalledTimes(1);
    expect(bitacora.insert).toHaveBeenCalledTimes(1);
  });
});
