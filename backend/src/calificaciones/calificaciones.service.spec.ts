import { In } from 'typeorm';
import { CalificacionesService } from './calificaciones.service';

describe('CalificacionesService.porAlumno', () => {
  it('un MAESTRO recibe solo las calificaciones de sus materias con inscripción activa', async () => {
    const repo = { find: jest.fn().mockResolvedValue([]) };
    const grupoMaterias = { find: jest.fn().mockResolvedValue([
      { id: 21, grupoId: 3, docenteId: 7, grupo: { activo: true } },
      { id: 22, grupoId: 4, docenteId: 7, grupo: { activo: false } },
    ]) };
    const inscripciones = { find: jest.fn().mockResolvedValue([{ grupoId: 3, alumnoId: 15, estatus: 'ACTIVA' }]) };
    const docentes = { obtenerPorUsuario: jest.fn().mockResolvedValue({ id: 7 }) };
    const alumnos = { obtener: jest.fn().mockResolvedValue({ id: 15, plantelId: 1 }) };
    const scope = { validarGestion: jest.fn() };
    const service = new CalificacionesService(
      repo as any, grupoMaterias as any, inscripciones as any, docentes as any, alumnos as any, scope as any, {} as any,
    );

    await service.porAlumno(15, {
      sub: 70, email: 'maestro@example.invalid', nombre: 'Maestro', roles: ['MAESTRO'],
    });

    expect(inscripciones.find).toHaveBeenCalledWith({
      where: { alumnoId: 15, grupoId: In([3]), estatus: 'ACTIVA' },
    });
    expect(repo.find).toHaveBeenCalledWith(expect.objectContaining({
      where: { alumnoId: 15, grupoMateriaId: In([21]) },
    }));
    expect(scope.validarGestion).not.toHaveBeenCalled();
  });

  it('rechaza al MAESTRO que consulta directamente una materia de un grupo inactivo', async () => {
    const grupoMaterias = { findOne: jest.fn().mockResolvedValue({
      id: 21, grupoId: 3, docenteId: 7, grupo: { activo: false },
    }) };
    const docentes = { obtenerPorUsuario: jest.fn().mockResolvedValue({ id: 7 }) };
    const service = new CalificacionesService(
      {} as any, grupoMaterias as any, {} as any, docentes as any, {} as any, {} as any, {} as any,
    );

    await expect(service.porGrupoMateria(21, {
      sub: 70, email: 'maestro@example.invalid', nombre: 'Maestro', roles: ['MAESTRO'],
    })).rejects.toThrow('El grupo no está activo');
  });
});
