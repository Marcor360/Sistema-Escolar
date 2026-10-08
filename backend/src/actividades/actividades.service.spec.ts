import { ActividadesService } from './actividades.service';

describe('ActividadesService access by group status', () => {
  it('blocks a teacher from listing activities of an inactive group', async () => {
    const grupoMaterias = {
      findOne: jest.fn().mockResolvedValue({
        id: 12,
        grupoId: 3,
        docenteId: 7,
        grupo: { id: 3, activo: false },
      }),
    };
    const actividades = { find: jest.fn() };
    const docentes = { obtenerPorUsuario: jest.fn().mockResolvedValue({ id: 7 }) };
    const service = new ActividadesService(
      actividades as any,
      {} as any,
      {} as any,
      grupoMaterias as any,
      {} as any,
      {} as any,
      docentes as any,
      {} as any,
      {} as any,
    );

    await expect(service.listarPorGrupoMateria(12, {
      sub: 70, email: 'maestro@example.invalid', nombre: 'Maestro', roles: ['MAESTRO'],
    })).rejects.toThrow('El grupo no está activo');
    expect(actividades.find).not.toHaveBeenCalled();
  });
});

describe('ActividadesService.entregar', () => {
  const actor = { sub: 20, roles: ['ALUMNO'] } as any;
  const crearServicio = (actividad: any, previa: any = null) => {
    const actividades = { findOne: jest.fn().mockResolvedValue(actividad) };
    const entregas = {
      findOne: jest.fn().mockResolvedValue(previa),
      create: jest.fn((dato) => dato),
      save: jest.fn(async (dato) => dato),
    };
    const grupoMaterias = { findOne: jest.fn().mockResolvedValue({ id: 12, grupoId: 3, grupo: { activo: true, ciclo: { activo: true }, plantel: { activo: true } } }) };
    const inscripciones = { findOne: jest.fn().mockResolvedValue({ id: 1 }) };
    const alumnos = { obtenerPorUsuario: jest.fn().mockResolvedValue({ id: 8 }) };
    const manager = { getRepository: jest.fn((entity) => ({
      Actividad: actividades, Entrega: entregas,
    })[entity.name as 'Actividad' | 'Entrega']) };
    const dataSource = { transaction: jest.fn((fn) => fn(manager)) };
    const service = new ActividadesService(
      actividades as any, entregas as any, {} as any, grupoMaterias as any,
      inscripciones as any, alumnos as any, {} as any, {} as any, dataSource as any,
    );
    return { service, actividades, entregas, grupoMaterias, inscripciones };
  };

  it('rechaza entregas para una actividad desactivada', async () => {
    const { service, entregas, grupoMaterias } = crearServicio({ id: 5, activo: false, grupoMateriaId: 12 });

    await expect(service.entregar(5, actor, {})).rejects.toThrow('ya no admite entregas');
    expect(grupoMaterias.findOne).not.toHaveBeenCalled();
    expect(entregas.save).not.toHaveBeenCalled();
  });

  it('rechaza la reentrega de una actividad calificada y conserva la nota', async () => {
    const previa = { id: 9, actividadId: 5, alumnoId: 8, estatus: 'CALIFICADA', calificacion: 92 };
    const { service, entregas } = crearServicio({ id: 5, activo: true, grupoMateriaId: 12, fechaEntrega: null }, previa);
    await expect(service.entregar(5, actor, { comentario: 'Corrección' })).rejects.toThrow('no admite reentrega');
    expect(previa.calificacion).toBe(92);
    expect(entregas.save).not.toHaveBeenCalled();
  });

  it('responde con error de validación cuando falta el archivo de material', async () => {
    const { service } = crearServicio({ id: 5, activo: true, grupoMateriaId: 12 });

    await expect(service.subirMaterial(12, 'Guía', undefined, actor))
      .rejects.toThrow('Selecciona un archivo');
  });
});

describe('edición de actividad frente a baja concurrente', () => {
  it('usa el estado bloqueado y conserva la baja ocurrida después de la lectura inicial', async () => {
    const antigua = { id: 5, grupoMateriaId: 12, activo: true, titulo: 'Antes', descripcion: 'Texto', tipo: 'TAREA', parcial: 1, ponderacion: 0, fechaEntrega: null };
    const actual = { ...antigua, activo: false };
    const repo = { findOne: jest.fn().mockResolvedValueOnce(antigua).mockResolvedValueOnce(actual), save: jest.fn(async (dato) => dato) };
    const ds = { transaction: jest.fn((fn) => fn({ getRepository: () => repo })) };
    const service = new ActividadesService(repo as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, ds as any);
    jest.spyOn(service as any,'validarPropiedad').mockResolvedValue({});
    await expect(service.actualizar(5,{ titulo: 'Corregido',descripcion: null },{ sub: 1,roles: ['SUPERADMIN'] } as any)).resolves.toMatchObject({ activo: false,titulo: 'Corregido',descripcion: null });
  });
});
