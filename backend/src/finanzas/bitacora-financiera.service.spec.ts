import { BitacoraFinancieraService } from './bitacora-financiera.service';

describe('BitacoraFinancieraService.listar alcance', () => {
  it('filtra los registros por planteles asignados al actor', async () => {
    const repo = { find: jest.fn().mockResolvedValue([]) };
    const scope = { resolverFiltro: jest.fn().mockResolvedValue([2, 4]) };
    const service = new BitacoraFinancieraService(repo as any, scope as any);

    await service.listar({ sub: 7, email: 'f@example.invalid', nombre: 'Finanzas', roles: ['FINANZAS'] });

    expect(repo.find).toHaveBeenCalledWith(expect.objectContaining({
      where: { plantelId: expect.anything() },
      order: { createdAt: 'DESC' },
      take: 300,
    }));
  });

  it('permite al SUPERADMIN consultar la bitácora global', async () => {
    const repo = { find: jest.fn().mockResolvedValue([]) };
    const scope = { resolverFiltro: jest.fn().mockResolvedValue(null) };
    const service = new BitacoraFinancieraService(repo as any, scope as any);

    await service.listar({ sub: 1, email: 'root@example.invalid', nombre: 'Root', roles: ['SUPERADMIN'] });

    expect(repo.find).toHaveBeenCalledWith({ order: { createdAt: 'DESC' }, take: 300 });
  });
});

describe('BitacoraFinancieraService.registrar', () => {
  it('usa el repositorio de la transacción recibida', async () => {
    const repoGlobal = { insert: jest.fn() };
    const repoTransaccional = { insert: jest.fn().mockResolvedValue(undefined) };
    const manager = { getRepository: jest.fn().mockReturnValue(repoTransaccional) };
    const service = new BitacoraFinancieraService(repoGlobal as any, {} as any);

    await service.registrar(7, 'CREAR_CARGO', 'cargo', 11, 'Cargo $100', 3, manager as any);

    expect(manager.getRepository).toHaveBeenCalled();
    expect(repoTransaccional.insert).toHaveBeenCalledWith(expect.objectContaining({
      usuarioId: 7, entidadId: 11, plantelId: 3,
    }));
    expect(repoGlobal.insert).not.toHaveBeenCalled();
  });
});
