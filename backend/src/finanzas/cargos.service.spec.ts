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
    const cargo = {
      id: 1, monto: 1000, descuento: 100, recargo: 0, estatus: 'VENCIDO', alumno: { plantelId: 4 },
    };
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

describe('CargosService.generarColegiaturas', () => {
  const crearServicio = (guardar: jest.Mock) => {
    const grupos = { find: jest.fn().mockResolvedValue([{ id: 4, plantelId: 2 }]) };
    const inscripciones = { find: jest.fn().mockResolvedValue([
      { alumnoId: 8, alumno: { plantelId: 2 } }, { alumnoId: 9, alumno: { plantelId: 2 } },
    ]) };
    const cargos = {
      find: jest.fn().mockResolvedValue([]),
      create: jest.fn((dato) => dato),
      save: guardar,
    };
    const conceptos = { porClave: jest.fn().mockResolvedValue({ id: 5, montoBase: 100 }) };
    const scope = { resolverFiltro: jest.fn().mockResolvedValue([2]), condicion: jest.fn((ids) => ids) };
    const bitacora = { registrar: jest.fn().mockResolvedValue(undefined) };
    const service = new CargosService(
      cargos as any, {} as any, inscripciones as any, grupos as any, {} as any,
      conceptos as any, bitacora as any, scope as any,
    );
    return { service, cargos, bitacora };
  };

  it('usa ciclo en la consulta y una clave única estable por alumno, ciclo y periodo', async () => {
    const guardar = jest.fn().mockImplementation(async (cargo) => ({ id: 20, ...cargo }));
    const { service, cargos } = crearServicio(guardar);

    const resultado = await service.generarColegiaturas(
      { cicloId: 3, periodo: '2026-09' } as any,
      { sub: 1, roles: ['FINANZAS'] } as any,
    );

    expect(cargos.find).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ conceptoId: 5, cicloId: 3, periodo: '2026-09' }),
    }));
    expect(guardar.mock.calls.map(([cargo]) => cargo.claveGeneracion)).toEqual([
      'COLEGIATURA:3:8:2026-09', 'COLEGIATURA:3:9:2026-09',
    ]);
    expect(resultado).toMatchObject({ generados: 2, omitidos: 0 });
  });

  it('cuenta un conflicto único de otra ejecución como omitido sin duplicar cargos', async () => {
    const duplicado = Object.assign(new Error('duplicate key'), { code: 'ER_DUP_ENTRY' });
    const guardar = jest.fn().mockRejectedValueOnce(duplicado).mockImplementation(async (cargo) => cargo);
    const { service, bitacora } = crearServicio(guardar);

    const resultado = await service.generarColegiaturas(
      { cicloId: 3, periodo: '2026-09' } as any,
      { sub: 1, roles: ['FINANZAS'] } as any,
    );

    expect(resultado).toMatchObject({ generados: 1, omitidos: 1 });
    expect(bitacora.registrar).toHaveBeenCalledWith(
      1, 'GENERAR_COLEGIATURAS', 'cargo', null,
      expect.stringContaining('omitidos=1'), 2,
    );
  });
});
