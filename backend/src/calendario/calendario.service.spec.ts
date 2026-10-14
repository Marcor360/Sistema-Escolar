import { ConflictException, ForbiddenException } from '@nestjs/common';
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

describe('CalendarioService.editar', () => {
  const fecha = new Date('2026-11-01T10:00:00.000Z');
  const crear = (datos: Record<string, unknown>) => {
    const repo = {
      findOne: jest.fn().mockResolvedValue({ id: 17, creadoPorId: 20, plantelId: 2, grupoId: 7, fechaInicio: fecha, fechaFin: null, titulo: 'Examen', ...datos }),
      merge: jest.fn((evento: object, cambios: object) => ({ ...evento, ...cambios })),
      save: jest.fn(async (evento: object) => evento),
    };
    const manager = { getRepository: jest.fn().mockReturnValue(repo) };
    const eventos = { manager: { transaction: jest.fn(async (fn: (m: typeof manager) => Promise<unknown>) => fn(manager)) } };
    const docentes = { findOne: jest.fn().mockResolvedValue({ id: 5 }) };
    const grupoMaterias = { findOne: jest.fn().mockResolvedValue({ grupoId: 7, grupo: { activo: true, ciclo: { activo: true }, plantel: { activo: true } } }) };
    const service = new CalendarioService(
      eventos as never, {} as never, grupoMaterias as never,
      {} as never, {} as never, docentes as never, {} as never,
    );
    return { service, repo };
  };

  it('rechaza editar un evento ajeno antes de persistir cambios', async () => {
    const { service, repo } = crear({ creadoPorId: 99 });
    await expect(service.editar(17, { titulo: 'Corregido', fechaInicioEsperada: fecha.toISOString() }, maestro))
      .rejects.toBeInstanceOf(ForbiddenException);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('detecta edición obsoleta por fecha original', async () => {
    const { service, repo } = crear({});
    await expect(service.editar(17, { titulo: 'Corregido', fechaInicioEsperada: '2026-10-01T10:00:00.000Z' }, maestro))
      .rejects.toBeInstanceOf(ConflictException);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('edita título de un evento propio en una transacción sin cambiar el grupo', async () => {
    const { service, repo } = crear({});
    const actualizado = await service.editar(17, { titulo: '  Examen reprogramado ', fechaInicioEsperada: fecha.toISOString() }, maestro);
    expect(actualizado.titulo).toBe('Examen reprogramado');
    expect(repo.merge).toHaveBeenCalledWith(expect.objectContaining({ grupoId: 7 }), { titulo: 'Examen reprogramado' });
    expect(repo.save).toHaveBeenCalledTimes(1);
  });
});
