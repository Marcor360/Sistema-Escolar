import type { Repository, DataSource } from 'typeorm';
import type { Actividad } from '../entities/actividad.entity';
import type { Entrega } from '../entities/entrega.entity';
import type { Material } from '../entities/material.entity';
import type { GrupoMateria } from '../entities/grupo-materia.entity';
import type { Inscripcion } from '../entities/inscripcion.entity';
import type { AlumnosService } from '../alumnos/alumnos.service';
import type { DocentesService } from '../docentes/docentes.service';
import type { ScopeService } from '../planteles/scope.service';
import type { JwtUser } from '../common/current-user.decorator';
import { stub } from '../test-utils/stub';
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
      stub<Repository<Actividad>>(actividades),
      stub<Repository<Entrega>>({}),
      stub<Repository<Material>>({}),
      stub<Repository<GrupoMateria>>(grupoMaterias),
      stub<Repository<Inscripcion>>({}),
      stub<AlumnosService>({}),
      stub<DocentesService>(docentes),
      stub<ScopeService>({}),
      stub<DataSource>({}),
    );

    await expect(
      service.listarPorGrupoMateria(12, {
        sub: 70,
        email: 'maestro@example.invalid',
        nombre: 'Maestro',
        roles: ['MAESTRO'],
      }),
    ).rejects.toThrow('El grupo no está activo');
    expect(actividades.find).not.toHaveBeenCalled();
  });
});

describe('ActividadesService.entregar', () => {
  const actor = stub<JwtUser>({ sub: 20, roles: ['ALUMNO'] });
  const crearServicio = (actividad: Partial<Actividad>, previa: Partial<Entrega> | null = null) => {
    const actividades = { findOne: jest.fn().mockResolvedValue(actividad) };
    const entregas = {
      findOne: jest.fn().mockResolvedValue(previa),
      create: jest.fn().mockImplementation((dato: Record<string, unknown>) => dato),
      save: jest.fn(async (dato) => dato),
    };
    const grupoMaterias = {
      findOne: jest
        .fn()
        .mockResolvedValue({
          id: 12,
          grupoId: 3,
          grupo: { activo: true, ciclo: { activo: true }, plantel: { activo: true } },
        }),
    };
    const inscripciones = { findOne: jest.fn().mockResolvedValue({ id: 1 }) };
    const alumnos = { obtenerPorUsuario: jest.fn().mockResolvedValue({ id: 8 }) };
    const manager = {
      getRepository: jest.fn(
        (entity) =>
          ({
            Actividad: actividades,
            Entrega: entregas,
          })[entity.name as 'Actividad' | 'Entrega'],
      ),
    };
    const dataSource = { transaction: jest.fn((fn) => fn(manager)) };
    const service = new ActividadesService(
      stub<Repository<Actividad>>(actividades),
      stub<Repository<Entrega>>(entregas),
      stub<Repository<Material>>({}),
      stub<Repository<GrupoMateria>>(grupoMaterias),
      stub<Repository<Inscripcion>>(inscripciones),
      stub<AlumnosService>(alumnos),
      stub<DocentesService>({}),
      stub<ScopeService>({}),
      stub<DataSource>(dataSource),
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
    const previa = { id: 9, actividadId: 5, alumnoId: 8, estatus: 'CALIFICADA' as const, calificacion: 92 };
    const { service, entregas } = crearServicio(
      { id: 5, activo: true, grupoMateriaId: 12, fechaEntrega: null },
      previa,
    );
    await expect(service.entregar(5, actor, { comentario: 'Corrección' })).rejects.toThrow('no admite reentrega');
    expect(previa.calificacion).toBe(92);
    expect(entregas.save).not.toHaveBeenCalled();
  });

  it('responde con error de validación cuando falta el archivo de material', async () => {
    const { service } = crearServicio({ id: 5, activo: true, grupoMateriaId: 12 });

    await expect(service.subirMaterial(12, 'Guía', undefined, actor)).rejects.toThrow('Selecciona un archivo');
  });
});

describe('edición de actividad frente a baja concurrente', () => {
  it('usa el estado bloqueado y conserva la baja ocurrida después de la lectura inicial', async () => {
    const antigua = {
      id: 5,
      grupoMateriaId: 12,
      activo: true,
      titulo: 'Antes',
      descripcion: 'Texto',
      tipo: 'TAREA',
      parcial: 1,
      ponderacion: 0,
      fechaEntrega: null,
    };
    const actual = { ...antigua, activo: false };
    const repo = {
      findOne: jest.fn().mockResolvedValueOnce(antigua).mockResolvedValueOnce(actual),
      save: jest.fn(async (dato) => dato),
    };
    const ds = { transaction: jest.fn((fn) => fn({ getRepository: () => repo })) };
    const service = new ActividadesService(
      stub<Repository<Actividad>>(repo),
      stub<Repository<Entrega>>({}),
      stub<Repository<Material>>({}),
      stub<Repository<GrupoMateria>>({
        findOne: jest
          .fn()
          .mockResolvedValue({
            id: 12,
            grupo: { activo: true, ciclo: { activo: true }, plantel: { activo: true } },
            materia: { activo: true },
          }),
      }),
      stub<Repository<Inscripcion>>({}),
      stub<AlumnosService>({}),
      stub<DocentesService>({}),
      stub<ScopeService>({}),
      stub<DataSource>(ds),
    );
    await expect(
      service.actualizar(
        5,
        { titulo: 'Corregido', descripcion: null },
        stub<JwtUser>({ sub: 1, roles: ['SUPERADMIN'] }),
      ),
    ).resolves.toMatchObject({ activo: false, titulo: 'Corregido', descripcion: null });
  });
});
