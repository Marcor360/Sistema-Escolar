import { ForbiddenException } from '@nestjs/common';
import { AlumnosService } from './alumnos.service';

describe('AlumnosService.listar', () => {
  it('pagina=2, porPagina=20 aplica skip(20).take(20) y devuelve el total', async () => {
    const alumnosRepo = { findAndCount: jest.fn().mockResolvedValue([[{ id: 1 }], 45]) };
    const service = new AlumnosService(alumnosRepo as any, {} as any, {} as any, {} as any, {} as any, {} as any);

    const resultado = await service.listar({ pagina: 2, porPagina: 20 } as any);

    expect(alumnosRepo.findAndCount).toHaveBeenCalledWith(expect.objectContaining({ skip: 20, take: 20 }));
    expect(resultado).toEqual({ datos: [{ id: 1 }], total: 45, pagina: 2, porPagina: 20 });
  });
});

describe('AlumnosService.obtener alcance docente', () => {
  it('rechaza el perfil de un alumno que no pertenece a grupos del docente', async () => {
    const qb = {
      where: jest.fn().mockReturnThis(), andWhere: jest.fn().mockReturnThis(),
      getCount: jest.fn().mockResolvedValue(0),
    };
    const inscripciones = { createQueryBuilder: jest.fn().mockReturnValue(qb) };
    const scope = { validarGestion: jest.fn() };
    const service = new AlumnosService(
      { findOne: jest.fn().mockResolvedValue({ id: 8, plantelId: 1 }) } as any,
      inscripciones as any, {} as any, {} as any, scope as any, {} as any,
    );

    await expect(service.obtener(8, {
      sub: 7, email: 'maestro@example.invalid', nombre: 'Maestro', roles: ['MAESTRO'],
    })).rejects.toBeInstanceOf(ForbiddenException);
    expect(scope.validarGestion).not.toHaveBeenCalled();
  });
});
