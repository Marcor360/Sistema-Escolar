import { PagosService } from './pagos.service';

describe('PagosService.registrarDePasarela', () => {
  const orden = { id: 12, alumnoId: 8, cargoId: 3, alumno: { plantelId: 2 } } as any;

  it('reutiliza el pago si Openpay reenvía el webhook', async () => {
    const pago = { id: 40, ordenPagoId: 12 };
    const repo = { findOne: jest.fn().mockResolvedValue(pago), create: jest.fn(), save: jest.fn() };
    const cargos = { recalcularEstatus: jest.fn() };
    const manager = { getRepository: jest.fn() };
    const dataSource = { transaction: jest.fn((callback) => callback(manager as any)) };
    const service = new PagosService(repo as any, {} as any, cargos as any, {} as any, dataSource as any);

    await expect(service.registrarDePasarela(orden, 125, 'ch_12')).resolves.toEqual({ pago, creado: false });
    expect(repo.save).not.toHaveBeenCalled();
    expect(cargos.recalcularEstatus).toHaveBeenCalledWith(3, manager);
  });

  it('recupera el pago que ganó una inserción concurrente', async () => {
    const pago = { id: 40, ordenPagoId: 12 };
    const repo = {
      findOne: jest.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(pago),
      create: jest.fn((datos) => datos),
      save: jest.fn().mockRejectedValue(new Error('unique constraint')),
    };
    const txRepo = { create: jest.fn((datos) => datos), save: jest.fn().mockRejectedValue(new Error('unique constraint')) };
    const manager = { getRepository: jest.fn().mockReturnValue(txRepo) };
    const dataSource = { transaction: jest.fn((callback) => callback(manager as any)) };
    const cargos = { recalcularEstatus: jest.fn() };
    const service = new PagosService(repo as any, {} as any, cargos as any, {} as any, dataSource as any);

    await expect(service.registrarDePasarela(orden, 125, 'ch_12')).resolves.toEqual({ pago, creado: false });
    expect(cargos.recalcularEstatus).toHaveBeenCalledWith(3, manager);
  });
});
