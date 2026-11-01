import type { Repository } from 'typeorm';
import type { Alumno } from '../entities/alumno.entity';
import type { CarreraPlan } from '../entities/carrera-plan.entity';
import type { EgresoAlumno } from '../entities/egreso-alumno.entity';
import type { Inscripcion } from '../entities/inscripcion.entity';
import type { TitulacionExpediente } from '../entities/titulacion-expediente.entity';
import type { ScopeService } from '../planteles/scope.service';
import { stub } from '../test-utils/stub';
import { TitulacionService } from './titulacion.service';

const director = { sub: 2, nombre: 'Rector', email: 'rector@example.test', roles: ['DIRECTOR'], portal: 'WEB' as const };

function escenario(plantelAlumno = 1, plantelCarrera = 1) {
  const qb: Record<string, jest.Mock> = {};
  for (const metodo of ['innerJoin', 'andWhere', 'orderBy', 'skip', 'take']) {
    qb[metodo] = jest.fn().mockReturnValue(qb);
  }
  qb.getManyAndCount = jest.fn().mockResolvedValue([[], 0]);
  const expedientes = {
    createQueryBuilder: jest.fn().mockReturnValue(qb),
    findOne: jest.fn().mockResolvedValue(null),
    create: jest.fn((datos: unknown) => datos),
    save: jest.fn(async (datos: Record<string, unknown>) => ({ ...datos, id: 100 })),
  };
  const egresos = { findOne: jest.fn().mockResolvedValue({ id: 7, alumnoId: 12 }) };
  const carreras = { findOne: jest.fn().mockResolvedValue({ id: 4, plantelId: plantelCarrera, activo: true }) };
  const alumnos = { findOne: jest.fn().mockResolvedValue({ id: 12, plantelId: plantelAlumno, estatus: 'EGRESADO' }) };
  const inscripciones = { exist: jest.fn().mockResolvedValue(true) };
  const scope = { validarGestion: jest.fn().mockResolvedValue(undefined), plantelesDe: jest.fn().mockResolvedValue([1]) };
  const service = new TitulacionService(
    stub<Repository<TitulacionExpediente>>(expedientes),
    stub<Repository<EgresoAlumno>>(egresos),
    stub<Repository<CarreraPlan>>(carreras),
    stub<Repository<Alumno>>(alumnos),
    stub<Repository<Inscripcion>>(inscripciones),
    stub<ScopeService>(scope),
  );
  return { service, expedientes, egresos, carreras, alumnos, inscripciones, scope, qb };
}

describe('titulación: borradores con RVOE pendiente', () => {
  it('rechaza cuentas sin DIRECTOR aunque sean SUPERADMIN', async () => {
    const { service } = escenario();
    await expect(service.crearBorrador({ egresoId: 7, carreraPlanId: 4 },
      { ...director, roles: ['SUPERADMIN'] })).rejects.toThrow('DIRECTOR');
  });
  it('rechaza el portal móvil', async () => {
    const { service } = escenario();
    await expect(service.crearBorrador({ egresoId: 7, carreraPlanId: 4 },
      { ...director, portal: 'MOVIL' })).rejects.toThrow('requiere el rol DIRECTOR desde web');
  });
  it('rechaza programas de un plantel diferente', async () => {
    const { service, expedientes } = escenario(1, 3);
    await expect(service.crearBorrador({ egresoId: 7, carreraPlanId: 4 }, director)).rejects.toThrow('plantel');
    expect(expedientes.save).not.toHaveBeenCalled();
  });
  it('rechaza egresos inexistentes', async () => {
    const { service, egresos } = escenario();
    egresos.findOne.mockResolvedValueOnce(null);
    await expect(service.crearBorrador({ egresoId: 7, carreraPlanId: 4 }, director)).rejects.toThrow('no encontrado');
  });
  it('rechaza carreras sin inscripción comprobable del egresado', async () => {
    const { service, inscripciones, expedientes } = escenario();
    inscripciones.exist.mockResolvedValueOnce(false);
    await expect(service.crearBorrador({ egresoId: 7, carreraPlanId: 4 }, director))
      .rejects.toThrow('historial académico');
    expect(expedientes.save).not.toHaveBeenCalled();
  });
  it('rechaza crear expedientes duplicados', async () => {
    const { service, expedientes } = escenario();
    expedientes.findOne.mockResolvedValueOnce({ id: 10 });
    await expect(service.crearBorrador({ egresoId: 7, carreraPlanId: 4 }, director)).rejects.toThrow('Ya existe');
  });
  it('crea únicamente un borrador no firmado cuando el alumno egresó', async () => {
    const { service, expedientes, scope } = escenario();
    const resultado = await service.crearBorrador({ egresoId: 7, carreraPlanId: 4 }, director);
    expect(scope.validarGestion).toHaveBeenCalledWith(director, 1);
    expect(expedientes.save).toHaveBeenCalledTimes(1);
    expect(resultado).toMatchObject({ id: 100, estado: 'BORRADOR', modalidadRvoe: 'SIN_DETERMINAR' });
    expect(expedientes.save).toHaveBeenCalled();
  });
  it('acepta el alcance global de una cuenta DIRECTOR y SUPERADMIN', async () => {
    const { service, scope, qb } = escenario();
    scope.plantelesDe.mockResolvedValueOnce(null);
    const resultado = await service.listar({ pagina: 1, porPagina: 10 },
      { ...director, roles: ['DIRECTOR', 'SUPERADMIN'] });
    expect(resultado.total).toBe(0);
    expect(qb.andWhere).not.toHaveBeenCalled();
  });

  it('conserva el filtro de planteles para un director sin alcance global', async () => {
    const { service, qb } = escenario();
    await service.listar({ pagina: 1, porPagina: 10 }, director);
    expect(qb.andWhere).toHaveBeenCalledWith(
      'al.plantelId IN (:...permitidos)', { permitidos: [1] },
    );
  });

  it('impide listar si el director no tiene planteles asignados', async () => {
    const { service, scope, qb } = escenario();
    scope.plantelesDe.mockResolvedValueOnce([]);
    await expect(service.listar({ pagina: 1, porPagina: 10 }, director))
      .rejects.toThrow('Asigna un plantel');
    expect(qb.andWhere).not.toHaveBeenCalled();
  });

});
