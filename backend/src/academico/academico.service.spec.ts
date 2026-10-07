import { ConflictException, ForbiddenException } from '@nestjs/common';
import { AcademicoService } from './academico.service';

function crearServicio(overrides: {
  grupos?: any;
  grupoMaterias?: any;
  inscripciones?: any;
  alumnos?: any;
  calificaciones?: any;
  actividades?: any;
  materiales?: any;
  docentes?: any;
  usuarioPlanteles?: any;
  scope?: any;
  dataSource?: any;
  }) {
  return new AcademicoService(
    {} as any,
    {} as any,
    overrides.grupos ?? ({} as any),
    overrides.grupoMaterias ?? ({} as any),
    overrides.inscripciones ?? ({} as any),
    overrides.alumnos ?? ({} as any),
    overrides.calificaciones ?? ({} as any),
    overrides.actividades ?? ({} as any),
    overrides.materiales ?? ({} as any),
    overrides.docentes ?? ({} as any),
    overrides.scope ?? ({ validarGestion: jest.fn().mockResolvedValue(undefined) } as any),
    overrides.usuarioPlanteles ?? ({} as any),
    overrides.dataSource ?? ({} as any),
  );
}

describe('AcademicoService.crearCiclo', () => {
  it.each([
    { code: 'ER_LOCK_DEADLOCK' },
    { originalError: { info: { number: 1205 } } },
    { driverError: { originalError: { info: { number: 1205 } } } },
  ])('convierte conflictos transaccionales del motor en un conflicto reintentable', async (error) => {
    const dataSource = { transaction: jest.fn().mockRejectedValue(error) };
    const service = crearServicio({ dataSource });

    await expect(service.crearCiclo({} as any)).rejects.toThrow(ConflictException);
    expect(dataSource.transaction).toHaveBeenCalledWith('SERIALIZABLE', expect.any(Function));
  });
});

describe('AcademicoService.eliminarGrupo', () => {
  it('rechaza la baja si el grupo tiene inscripciones activas', async () => {
    const grupos = {
      findOne: jest.fn().mockResolvedValue({ id: 1, plantelId: 5, activo: true }),
      update: jest.fn(),
    };
    const inscripciones = { count: jest.fn().mockResolvedValue(3) };
    const scope = { validarGestion: jest.fn().mockResolvedValue(undefined) };
    const manager = { getRepository: jest.fn((entity) => entity.name === 'Grupo' ? grupos : inscripciones) };
    const dataSource = { transaction: jest.fn((fn) => fn(manager)) };
    const service = crearServicio({ grupos, inscripciones, scope, dataSource });

    await expect(service.eliminarGrupo(1, { sub: 1, roles: ['ADMINISTRATIVO'] } as any))
      .rejects.toThrow(ConflictException);
    expect(grupos.update).not.toHaveBeenCalled();
  });

  it('da de baja el grupo cuando no hay inscripciones activas', async () => {
    const grupos = {
      findOne: jest.fn().mockResolvedValue({ id: 1, plantelId: 5, activo: true }),
      update: jest.fn().mockResolvedValue(undefined),
    };
    const inscripciones = { count: jest.fn().mockResolvedValue(0) };
    const scope = { validarGestion: jest.fn().mockResolvedValue(undefined) };
    const manager = { getRepository: jest.fn((entity) => entity.name === 'Grupo' ? grupos : inscripciones) };
    const dataSource = { transaction: jest.fn((fn) => fn(manager)) };
    const service = crearServicio({ grupos, inscripciones, scope, dataSource });

    const resultado = await service.eliminarGrupo(1, { sub: 1, roles: ['ADMINISTRATIVO'] } as any);

    expect(grupos.update).toHaveBeenCalledWith(1, { activo: false });
    expect(resultado).toEqual({ ok: true });
    expect(grupos.findOne).toHaveBeenCalledWith({
      where: { id: 1 }, lock: { mode: 'pessimistic_write' },
    });
  });
});

describe('AcademicoService.inscribirAlumno', () => {
  const actor = { sub: 1, roles: ['ADMINISTRATIVO'] } as any;

  it('rechaza grupos inactivos antes de crear una inscripción', async () => {
    const grupos = { findOne: jest.fn().mockResolvedValue({ id: 4, plantelId: 2, activo: false }) };
    const alumnos = { findOne: jest.fn() };
    const inscripciones = { save: jest.fn() };
    const manager = { getRepository: jest.fn((entity) => ({ Grupo: grupos, Alumno: alumnos, Inscripcion: inscripciones })[entity.name as 'Grupo' | 'Alumno' | 'Inscripcion']) };
    const dataSource = { transaction: jest.fn((fn) => fn(manager)) };
    const service = crearServicio({ grupos, alumnos, inscripciones, dataSource });

    await expect(service.inscribirAlumno(4, 9, actor)).rejects.toThrow('grupo inactivo');
    expect(alumnos.findOne).not.toHaveBeenCalled();
    expect(inscripciones.save).not.toHaveBeenCalled();
  });

  it('rechaza alumnos que no están activos', async () => {
    const grupos = { findOne: jest.fn().mockResolvedValue({ id: 4, plantelId: 2, activo: true }) };
    const alumnos = { findOne: jest.fn().mockResolvedValue({ id: 9, plantelId: 2, estatus: 'BAJA' }) };
    const inscripciones = { save: jest.fn() };
    const manager = { getRepository: jest.fn((entity) => ({ Grupo: grupos, Alumno: alumnos, Inscripcion: inscripciones })[entity.name as 'Grupo' | 'Alumno' | 'Inscripcion']) };
    const dataSource = { transaction: jest.fn((fn) => fn(manager)) };
    const service = crearServicio({ grupos, alumnos, inscripciones, dataSource });

    await expect(service.inscribirAlumno(4, 9, actor)).rejects.toThrow('alumno no está activo');
    expect(inscripciones.save).not.toHaveBeenCalled();
  });
});

describe('AcademicoService.eliminarGrupoMateria', () => {
  it('rechaza la baja si existen calificaciones ligadas', async () => {
    const grupoMaterias = {
      findOne: jest.fn().mockResolvedValue({ id: 10, grupo: { plantelId: 5 } }),
      delete: jest.fn(),
    };
    const calificaciones = { count: jest.fn().mockResolvedValue(2) };
    const actividades = { count: jest.fn().mockResolvedValue(0) };
    const materiales = { count: jest.fn().mockResolvedValue(0) };
    const scope = { validarGestion: jest.fn().mockResolvedValue(undefined) };
    const service = crearServicio({ grupoMaterias, calificaciones, actividades, materiales, scope });

    await expect(service.eliminarGrupoMateria(10, { sub: 1, roles: ['ADMINISTRATIVO'] } as any))
      .rejects.toThrow(ConflictException);
    expect(grupoMaterias.delete).not.toHaveBeenCalled();
  });
});

describe('AcademicoService.actualizarGrupo', () => {
  it('lanza ForbiddenException cuando el grupo está fuera del alcance del usuario', async () => {
    const grupos = { findOne: jest.fn().mockResolvedValue({ id: 1, plantelId: 5, activo: true }) };
    const scope = { validarGestion: jest.fn().mockRejectedValue(new ForbiddenException()) };
    const service = crearServicio({ grupos, scope });

    await expect(service.actualizarGrupo(1, { nombre: 'A' } as any, { sub: 1, roles: ['ADMINISTRATIVO'] } as any))
      .rejects.toThrow(ForbiddenException);
  });
});

describe('AcademicoService.alcance de grupo', () => {
  it('rechaza consultar alumnos si el plantel del grupo queda fuera del alcance', async () => {
    const grupos = { findOne: jest.fn().mockResolvedValue({ id: 22, plantelId: 9 }) };
    const inscripciones = { find: jest.fn() };
    const scope = { validarGestion: jest.fn().mockRejectedValue(new ForbiddenException()) };
    const service = crearServicio({ grupos, inscripciones, scope });

    await expect(service.alumnosDeGrupo(22, { sub: 1, roles: ['ADMINISTRATIVO'] } as any))
      .rejects.toThrow(ForbiddenException);
    expect(inscripciones.find).not.toHaveBeenCalled();
  });
});

describe('AcademicoService.asignarMateria', () => {
  it('convierte duplicados concurrentes de grupo-materia en conflicto controlado', async () => {
    const grupos = { findOne: jest.fn().mockResolvedValue({ id: 1, plantelId: 5, activo: true }) };
    const grupoMaterias = {
      findOne: jest.fn().mockResolvedValue(null), create: jest.fn((d) => d),
      save: jest.fn().mockRejectedValue({ number: 2601 }),
    };
    const service = crearServicio({ grupos, grupoMaterias });
    await expect(service.asignarMateria(1, { materiaId: 2 } as any, {
      sub: 7, roles: ['ADMINISTRATIVO'],
    } as any)).rejects.toThrow(ConflictException);
  });

  it('rechaza asignar un docente de otro plantel a la materia', async () => {
    const grupos = { findOne: jest.fn().mockResolvedValue({ id: 1, plantelId: 5, activo: true }) };
    const grupoMaterias = {
      findOne: jest.fn().mockResolvedValue(null), create: jest.fn(), save: jest.fn(),
    };
    const docentes = { obtener: jest.fn().mockResolvedValue({ id: 8, usuarioId: 90 }) };
    const usuarioPlanteles = { findOne: jest.fn().mockResolvedValue(null) };
    const service = crearServicio({ grupos, grupoMaterias, docentes, usuarioPlanteles });

    await expect(service.asignarMateria(1, { materiaId: 2, docenteId: 8 } as any, {
      sub: 7, roles: ['ADMINISTRATIVO'],
    } as any)).rejects.toThrow(ForbiddenException);
    expect(grupoMaterias.save).not.toHaveBeenCalled();
  });
});

describe('AcademicoService.listarGrupos', () => {
  it('excluye grupos inactivos por defecto', async () => {
    const grupos = { findAndCount: jest.fn().mockResolvedValue([[], 0]) };
    const scope = { resolverFiltro: jest.fn().mockResolvedValue(null) };
    const service = crearServicio({ grupos, scope });

    await service.listarGrupos({ sub: 1, roles: ['ADMINISTRATIVO'] } as any, { pagina: 1, porPagina: 20 } as any);

    expect(grupos.findAndCount).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ activo: true }) }),
    );
  });

  it('limita los grupos de MAESTRO a los que tienen una materia asignada', async () => {
    const grupos = { findAndCount: jest.fn().mockResolvedValue([[], 0]) };
    const grupoMaterias = { find: jest.fn().mockResolvedValue([{ grupoId: 6 }, { grupoId: 9 }]) };
    const docentes = { obtenerPorUsuario: jest.fn().mockResolvedValue({ id: 3 }) };
    const scope = { resolverFiltro: jest.fn() };
    const service = crearServicio({ grupos, grupoMaterias, docentes, scope });

    await service.listarGrupos(
      { sub: 7, roles: ['MAESTRO'] } as any,
      { pagina: 1, porPagina: 20 } as any,
    );

    expect(grupos.findAndCount).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: expect.anything(), activo: true }),
    }));
    expect(scope.resolverFiltro).not.toHaveBeenCalled();
  });
});
