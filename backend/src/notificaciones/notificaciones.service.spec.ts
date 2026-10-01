import { ForbiddenException } from '@nestjs/common';
import { NotificacionesService } from './notificaciones.service';

const admin = { sub: 4, email: 'admin@example.invalid', nombre: 'Admin', roles: ['ADMINISTRATIVO'] };

describe('NotificacionesService.difundir alcance', () => {
  it('rechaza destinatarios explícitos asignados a otro plantel', async () => {
    const repo = { insert: jest.fn() };
    const usuarios = { createQueryBuilder: jest.fn() };
    const alumnos = { find: jest.fn().mockResolvedValue([]) };
    const asignaciones = { find: jest.fn().mockResolvedValue([]) };
    const scope = { plantelesDe: jest.fn().mockResolvedValue([1]) };
    const service = new NotificacionesService(
      repo as any, usuarios as any, alumnos as any, asignaciones as any, scope as any,
      { get: jest.fn().mockReturnValue(undefined) } as any,
    );

    await expect(service.difundir('Aviso', 'Mensaje', { usuarioIds: [20] }, admin as any))
      .rejects.toBeInstanceOf(ForbiddenException);
    expect(repo.insert).not.toHaveBeenCalled();
  });

  it('limita difusión por rol a destinatarios de los planteles asignados', async () => {
    const query = {
      innerJoin: jest.fn().mockReturnThis(), select: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([{ id: 20 }, { id: 21 }]),
    };
    const repo = { insert: jest.fn().mockResolvedValue(undefined) };
    const usuarios = { createQueryBuilder: jest.fn().mockReturnValue(query) };
    const alumnos = { find: jest.fn().mockResolvedValue([{ usuarioId: 20 }]) };
    const asignaciones = { find: jest.fn().mockResolvedValue([]) };
    const scope = { plantelesDe: jest.fn().mockResolvedValue([1]) };
    const service = new NotificacionesService(
      repo as any, usuarios as any, alumnos as any, asignaciones as any, scope as any,
      { get: jest.fn().mockReturnValue(undefined) } as any,
    );

    await expect(service.difundir('Aviso', 'Mensaje', { rol: 'ALUMNO' }, admin as any))
      .resolves.toEqual({ enviadas: 1 });
    expect(repo.insert).toHaveBeenCalledWith([{ usuarioId: 20, titulo: 'Aviso', mensaje: 'Mensaje' }]);
  });
});
