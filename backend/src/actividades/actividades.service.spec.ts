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
    const grupoMaterias = { findOne: jest.fn().mockResolvedValue({ id: 12, grupoId: 3, grupo: { activo: true } }) };
    const inscripciones = { findOne: jest.fn().mockResolvedValue({ id: 1 }) };
    const alumnos = { obtenerPorUsuario: jest.fn().mockResolvedValue({ id: 8 }) };
    const manager = { getRepository: jest.fn((entity) => ({
      Actividad: actividades, Entrega: entregas,
    })[entity.name]) };
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

  it('reabre la calificación de una reentrega y conserva el bloqueo de la fila', async () => {
    const previa = {
      id: 9, actividadId: 5, alumnoId: 8, estatus: 'CALIFICADA',
      calificacion: 92, comentarioDocente: 'Primera revisión', comentarioAlumno: 'Original',
    };
    const { service, entregas } = crearServicio({ id: 5, activo: true, grupoMateriaId: 12, fechaEntrega: null }, previa);

    const resultado = await service.entregar(5, actor, { comentario: 'Corrección' });

    expect(resultado).toMatchObject({
      id: 9, estatus: 'ENTREGADA', calificacion: null, comentarioDocente: null,
      comentarioAlumno: 'Corrección',
    });
    expect(entregas.findOne).toHaveBeenCalledWith({
      where: { actividadId: 5, alumnoId: 8 }, lock: { mode: 'pessimistic_write' },
    });
  });

  it('responde con error de validación cuando falta el archivo de material', async () => {
    const { service } = crearServicio({ id: 5, activo: true, grupoMateriaId: 12 });

    await expect(service.subirMaterial(12, 'Guía', undefined, actor))
      .rejects.toThrow('Selecciona un archivo');
  });
});
