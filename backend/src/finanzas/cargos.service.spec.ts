import { CargosService } from './cargos.service';

describe('CargosService.saldoDeCargo / totalDeCargo', () => {
  const pagosSinMovimientos = () => ({
    createQueryBuilder: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([]),
    }),
  });

  it('saldoDeCargo = monto - descuento + recargo, redondeado a 2 decimales, sin pagos', async () => {
    const service = new CargosService(
      {} as any, pagosSinMovimientos() as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any,
    );
    const cargo = { id: 1, monto: 200, descuento: 50.005, recargo: 10 } as any;

    await expect(service.saldoDeCargo(cargo)).resolves.toBe(160);
  });
});

describe('CargosService.aplicarRecargos', () => {
  it('calcula (monto - descuento) x porcentaje/100 en cargos vencidos sin recargo previo', async () => {
    const cargo = { id: 1, monto: 1000, descuento: 100, recargo: 0, estatus: 'VENCIDO' };
    const qb = {
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([cargo]),
    };
    const cargosRepo = { createQueryBuilder: jest.fn().mockReturnValue(qb), save: jest.fn().mockResolvedValue(undefined) };
    const bitacora = { registrar: jest.fn().mockResolvedValue(undefined) };
    const scope = { resolverFiltro: jest.fn().mockResolvedValue(null) };
    const service = new CargosService(
      cargosRepo as any, {} as any, {} as any, {} as any, {} as any, {} as any, bitacora as any, scope as any,
    );
    const user = { sub: 1, roles: ['FINANZAS'] } as any;

    const resultado = await service.aplicarRecargos({ porcentaje: 10 }, user);

    expect(cargo.recargo).toBe(90); // (1000 - 100) * 10 / 100
    expect(resultado).toEqual({ aplicados: 1, porcentaje: 10 });
  });
});

describe('CargosService.crear', () => {
  it('valida al alumno (y con ello el alcance de su plantel) antes de crear el cargo', async () => {
    const conceptos = { obtener: jest.fn().mockResolvedValue({ id: 5 }) };
    const alumnosService = { obtener: jest.fn().mockResolvedValue({ id: 10, plantelId: 3 }) };
    const bitacora = { registrar: jest.fn().mockResolvedValue(undefined) };
    const cargosRepo = {
      create: jest.fn((d) => d),
      save: jest.fn((d) => Promise.resolve({ id: 99, ...d })),
    };
    const service = new CargosService(
      cargosRepo as any, {} as any, {} as any, {} as any, alumnosService as any, conceptos as any, bitacora as any, {} as any,
    );
    const user = { sub: 7, roles: ['FINANZAS'] } as any;
    const dto = { alumnoId: 10, conceptoId: 5, descripcion: 'Cargo', monto: 100 } as any;

    await service.crear(dto, user);

    expect(alumnosService.obtener).toHaveBeenCalledWith(10, user);
  });
});
