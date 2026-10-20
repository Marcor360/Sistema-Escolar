import { EntityManager } from 'typeorm';
import { Alumno, BitacoraAcademica, CicloEscolar, Grupo, Inscripcion, Plantel, SolicitudGrupoRegular } from '../entities';
import { JwtUser } from '../common/current-user.decorator';
import { ScopeService } from '../planteles/scope.service';
import { AgrupacionRegularService } from './agrupacion-regular.service';

jest.mock('../catalogos-academicos/contexto-grupo', () => ({
  validarContextoGrupo: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../recursamientos/acceso-recursamiento', () => ({
  limiteRegulares: jest.fn().mockResolvedValue(54),
}));

it('reutiliza el cupo contado dentro de la misma transacción y asigna el remanente 51', async () => {
  const contexto = { alumnoId: 41, plantelId: 2, cicloId: 3, nivelId: 1, carreraId: 1, periodoAcademicoId: 1, turno: 'MATUTINO' as const };
  const solicitud = { id: 19, ...contexto, alumno: { plantelId: 2, estatus: 'ACTIVO', usuario: { activo: true } } };
  const solicitudes = {
    create: jest.fn((datos: object) => datos),
    findOneBy: jest.fn().mockResolvedValue(null),
    findOneByOrFail: jest.fn().mockResolvedValue({ id: 19, estado: 'ASIGNADA', grupoId: 5 }),
    save: jest.fn().mockResolvedValue(solicitud),
    find: jest.fn().mockResolvedValue([solicitud]),
    update: jest.fn().mockResolvedValue(undefined),
  };
  const inscripciones = {
    findOne: jest.fn().mockResolvedValue(null),
    findOneBy: jest.fn().mockResolvedValue(null),
    countBy: jest.fn().mockResolvedValue(50),
    create: jest.fn((dato: object) => dato),
    save: jest.fn().mockResolvedValue({ id: 10 }),
  };
  const grupos = { find: jest.fn().mockResolvedValue([{ id: 5, ...contexto, activo: true, tipo: 'REGULAR' }]), save: jest.fn() };
  const repos = new Map<unknown, unknown>([
    [Plantel, { findOne: jest.fn().mockResolvedValue({ activo: true }) }],
    [CicloEscolar, { findOneBy: jest.fn().mockResolvedValue({ estado: 'ACTIVO' }) }],
    [Alumno, { findOne: jest.fn().mockResolvedValue({ id: 41, plantelId: 2, estatus: 'ACTIVO', usuario: { activo: true } }) }],
    [SolicitudGrupoRegular, solicitudes],
    [Inscripcion, inscripciones],
    [Grupo, grupos],
    [BitacoraAcademica, { insert: jest.fn().mockResolvedValue(undefined) }],
  ]);
  const m = { getRepository: (entidad: unknown) => repos.get(entidad) } as unknown as EntityManager;
  const scope = { validarGestion: jest.fn().mockResolvedValue(undefined) } as unknown as ScopeService;
  const user = { sub: 1, roles: ['ADMINISTRATIVO'] } as JwtUser;
  const respuesta = await new AgrupacionRegularService(scope).solicitar(m, contexto, user);

  expect(inscripciones.countBy).toHaveBeenCalledTimes(1);
  expect(solicitudes.update).toHaveBeenCalledWith(19, { estado: 'ASIGNADA', grupoId: 5 });
  expect(respuesta.asignadas).toEqual([19]);
});
