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
    );

    await expect(service.listarPorGrupoMateria(12, {
      sub: 70, email: 'maestro@example.invalid', nombre: 'Maestro', roles: ['MAESTRO'],
    })).rejects.toThrow('El grupo no está activo');
    expect(actividades.find).not.toHaveBeenCalled();
  });
});
