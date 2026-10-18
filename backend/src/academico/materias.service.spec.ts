import { MateriasService } from './materias.service';

it('ni SUPERADMIN puede desactivar una materia con clases vigentes', async () => {
  const materias = { findOne: jest.fn().mockResolvedValue({ id: 7 }), update: jest.fn() };
  const clases = { count: jest.fn().mockResolvedValue(1) };
  const service = new MateriasService(materias as never, clases as never);
  await expect(service.desactivarMateria(7)).rejects.toThrow('asignaciones o historial');
  expect(clases.count).toHaveBeenCalledWith({ where: { materiaId: 7 } });
  expect(materias.update).not.toHaveBeenCalled();
});
