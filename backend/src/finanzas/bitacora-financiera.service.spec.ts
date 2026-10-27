import type { Repository, EntityManager } from 'typeorm';
import type { BitacoraFinanciera } from '../entities/bitacora-financiera.entity';
import type { ScopeService } from '../planteles/scope.service';
import { stub } from '../test-utils/stub';
import { BitacoraFinancieraService } from './bitacora-financiera.service';

describe('BitacoraFinancieraService.listar alcance', () => {
  it('filtra los registros por planteles asignados al actor', async () => {
    const repo = { find: jest.fn().mockResolvedValue([]) };
    const scope = { resolverFiltro: jest.fn().mockResolvedValue([2, 4]) };
    const service = new BitacoraFinancieraService(
      stub<Repository<BitacoraFinanciera>>(repo),
      stub<ScopeService>(scope),
    );

    await service.listar({ sub: 7, email: 'f@example.invalid', nombre: 'Finanzas', roles: ['FINANZAS'] });

    expect(repo.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { plantelId: expect.anything() },
        order: { createdAt: 'DESC' },
        take: 300,
      }),
    );
  });

  it('permite al SUPERADMIN consultar la bitácora global', async () => {
    const repo = { find: jest.fn().mockResolvedValue([]) };
    const scope = { resolverFiltro: jest.fn().mockResolvedValue(null) };
    const service = new BitacoraFinancieraService(
      stub<Repository<BitacoraFinanciera>>(repo),
      stub<ScopeService>(scope),
    );

    await service.listar({ sub: 1, email: 'root@example.invalid', nombre: 'Root', roles: ['SUPERADMIN'] });

    expect(repo.find).toHaveBeenCalledWith({ order: { createdAt: 'DESC' }, take: 300 });
  });
});

describe('BitacoraFinancieraService.registrar', () => {
  it('usa el repositorio de la transacción recibida', async () => {
    const repoGlobal = { insert: jest.fn() };
    const repoTransaccional = { insert: jest.fn().mockResolvedValue(undefined) };
    const manager = { getRepository: jest.fn().mockReturnValue(repoTransaccional) };
    const service = new BitacoraFinancieraService(
      stub<Repository<BitacoraFinanciera>>(repoGlobal),
      stub<ScopeService>({}),
    );

    await service.registrar(7, 'CREAR_CARGO', 'cargo', 11, 'Cargo $100', 3, stub<EntityManager | undefined>(manager));

    expect(manager.getRepository).toHaveBeenCalled();
    expect(repoTransaccional.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        usuarioId: 7,
        entidadId: 11,
        plantelId: 3,
      }),
    );
    expect(repoGlobal.insert).not.toHaveBeenCalled();
  });
});

describe('resoluciones de conciliación paginadas', () => {
  it.each([
    [2, 10, 10],
    [3, 20, 40],
  ])('página %i, tamaño %i: filtra en servidor antes de paginar', async (pagina, porPagina, skip) => {
    const repo = { findAndCount: jest.fn().mockResolvedValue([[{ id: 15 }], 115]) };
    const scope = { resolverFiltro: jest.fn().mockResolvedValue([2]) };
    const service = new BitacoraFinancieraService(repo as never, scope as never);
    const resultado = await service.resoluciones(
      { sub: 7, email: 'f@example.invalid', nombre: 'Finanzas', roles: ['FINANZAS'] },
      { pagina, porPagina },
    );
    expect(resultado).toEqual({ datos: [{ id: 15 }], total: 115, pagina, porPagina });
    expect(repo.findAndCount).toHaveBeenCalledWith({
      where: {
        accion: expect.objectContaining({ _value: ['CONCILIAR_ORDEN', 'CONCILIAR_PAGO'] }),
        plantelId: expect.objectContaining({ _value: [2] }),
      },
      order: { createdAt: 'DESC', id: 'DESC' },
      skip,
      take: porPagina,
    });
  });
});
