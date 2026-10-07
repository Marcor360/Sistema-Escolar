import { ForbiddenException } from '@nestjs/common';
import { CalendarioService } from './calendario.service';
import { JwtUser } from '../common/current-user.decorator';

const maestro: JwtUser = {
  sub: 20,
  email: 'maestro@escuela.mx',
  nombre: 'Maestro',
  roles: ['MAESTRO'],
};

describe('CalendarioService', () => {
  it('filtra los eventos de grupo al grupo-materia asignado al docente', async () => {
    const qb = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    };
    const eventos = { createQueryBuilder: jest.fn().mockReturnValue(qb) };
    const docentes = { findOne: jest.fn().mockResolvedValue({ id: 5 }) };
    const grupoMaterias = { find: jest.fn().mockResolvedValue([{ grupoId: 7, grupo: { activo: true, plantelId: 2, ciclo: { activo: true }, plantel: { activo: true } } }]) };
    const scope = { resolverFiltro: jest.fn() };
    const service = new CalendarioService(
      eventos as any, {} as any, grupoMaterias as any, {} as any, {} as any, docentes as any, scope as any,
    );

    await service.listar(maestro);

    expect(qb.andWhere).toHaveBeenCalledWith(
      expect.stringContaining('e.grupo_id IN (:...grupoIds)'),
      { planteles: [2], grupoIds: [7] },
    );
    expect(scope.resolverFiltro).not.toHaveBeenCalled();
  });

  it('sin grupos activos, el maestro solo ve eventos globales', async () => {
    const qb = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    };
    const eventos = { createQueryBuilder: jest.fn().mockReturnValue(qb) };
    const docentes = { findOne: jest.fn().mockResolvedValue({ id: 5 }) };
    const grupoMaterias = { find: jest.fn().mockResolvedValue([{ grupoId: 7, grupo: { activo: false, plantelId: 2 } }]) };
    const service = new CalendarioService(
      eventos as any, {} as any, grupoMaterias as any, {} as any, {} as any, docentes as any, {} as any,
    );

    await service.listar(maestro);

    expect(qb.andWhere).toHaveBeenCalledWith('(e.plantel_id IS NULL AND e.grupo_id IS NULL)');
  });

  it('maestro no puede crear evento global', async () => {
    const service = new CalendarioService(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    await expect(
      service.crear({ titulo: 'Global', fechaInicio: '2026-07-10T10:00:00.000Z' }, maestro),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('maestro no puede crear eventos para un grupo inactivo', async () => {
    const docentes = { findOne: jest.fn().mockResolvedValue({ id: 5 }) };
    const grupoMaterias = { findOne: jest.fn().mockResolvedValue({
      grupoId: 7, grupo: { activo: false, plantelId: 2 },
    }) };
    const service = new CalendarioService(
      {} as any, {} as any, grupoMaterias as any, {} as any, {} as any, docentes as any, {} as any,
    );

    await expect(service.crear({
      titulo: 'Examen', grupoId: 7, fechaInicio: '2026-09-30T10:00:00.000Z',
    }, maestro)).rejects.toThrow('grupo inactivo');
  });
});
