import type { Repository, DataSource } from 'typeorm';
import type { Calificacion } from '../entities/calificacion.entity';
import type { GrupoMateria } from '../entities/grupo-materia.entity';
import type { Inscripcion } from '../entities/inscripcion.entity';
import type { PeriodoCalificacion } from '../entities/periodo-calificacion.entity';
import type { HistorialCalificacion } from '../entities/historial-calificacion.entity';
import type { DocentesService } from '../docentes/docentes.service';
import type { AlumnosService } from '../alumnos/alumnos.service';
import type { ScopeService } from '../planteles/scope.service';
import { stub } from '../test-utils/stub';
import { In } from 'typeorm';
import { CalificacionesService } from './calificaciones.service';

describe('CalificacionesService.porAlumno', () => {
  it('un MAESTRO recibe solo las calificaciones de sus materias con inscripción activa', async () => {
    const repo = { find: jest.fn().mockResolvedValue([]) };
    const grupoMaterias = {
      find: jest.fn().mockResolvedValue([
        {
          id: 21,
          grupoId: 3,
          docenteId: 7,
          grupo: { activo: true, ciclo: { activo: true }, plantel: { activo: true } },
        },
        { id: 22, grupoId: 4, docenteId: 7, grupo: { activo: false } },
      ]),
    };
    const inscripciones = { find: jest.fn().mockResolvedValue([{ grupoId: 3, alumnoId: 15, estatus: 'ACTIVA' }]) };
    const docentes = { obtenerPorUsuario: jest.fn().mockResolvedValue({ id: 7 }) };
    const alumnos = { obtener: jest.fn().mockResolvedValue({ id: 15, plantelId: 1 }) };
    const scope = { validarGestion: jest.fn() };
    const service = new CalificacionesService(
      stub<Repository<Calificacion>>(repo),
      stub<Repository<GrupoMateria>>(grupoMaterias),
      stub<Repository<Inscripcion>>(inscripciones),
      stub<Repository<PeriodoCalificacion>>({}),
      stub<Repository<HistorialCalificacion>>({}),
      stub<DocentesService>(docentes),
      stub<AlumnosService>(alumnos),
      stub<ScopeService>(scope),
      stub<DataSource>({}),
    );

    await service.porAlumno(15, {
      sub: 70,
      email: 'maestro@example.invalid',
      nombre: 'Maestro',
      roles: ['MAESTRO'],
    });

    expect(inscripciones.find).toHaveBeenCalledWith({
      where: { alumnoId: 15, grupoId: In([3]), estatus: In(['ACTIVA','HISTORICA']) },
    });
    expect(repo.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { alumnoId: 15, grupoMateriaId: In([21]) },
      }),
    );
    expect(scope.validarGestion).not.toHaveBeenCalled();
  });

  it('rechaza al MAESTRO que consulta directamente una materia de un grupo inactivo', async () => {
    const grupoMaterias = {
      findOne: jest.fn().mockResolvedValue({
        id: 21,
        grupoId: 3,
        docenteId: 7,
        grupo: { activo: false },
      }),
    };
    const docentes = { obtenerPorUsuario: jest.fn().mockResolvedValue({ id: 7 }) };
    const service = new CalificacionesService(
      stub<Repository<Calificacion>>({}),
      stub<Repository<GrupoMateria>>(grupoMaterias),
      stub<Repository<Inscripcion>>({}),
      stub<Repository<PeriodoCalificacion>>({}),
      stub<Repository<HistorialCalificacion>>({}),
      stub<DocentesService>(docentes),
      stub<AlumnosService>({}),
      stub<ScopeService>({}),
      stub<DataSource>({}),
    );

    await expect(
      service.porGrupoMateria(21, {
        sub: 70,
        email: 'maestro@example.invalid',
        nombre: 'Maestro',
        roles: ['MAESTRO'],
      }),
    ).rejects.toThrow('El grupo no está activo');
  });
});
