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
