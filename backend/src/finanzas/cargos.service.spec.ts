import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CargosService } from './cargos.service';
import { CrearCargoDto, GenerarColegiaturasDto } from './finanzas.dto';

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
      {} as any, pagosSinMovimientos() as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any,
    );
    const cargo = { id: 1, monto: 200, descuento: 50.005, recargo: 10 } as any;

    await expect(service.saldoDeCargo(cargo)).resolves.toBe(160);
  });
});

describe('CargosService.adeudos minimiza datos del alumno', () => {
  it('no devuelve CURP, tutor, dirección ni correo en el reporte financiero', async () => {
    const cargo = {
      id: 1, alumnoId: 10, conceptoId: 2, cicloId: null, periodo: '2026-09', claveGeneracion: 'interno',
      descripcion: 'Colegiatura', monto: 100, descuento: 0, recargo: 0, fechaVencimiento: null,
      estatus: 'PENDIENTE',
      alumno: {
        id: 10, usuarioId: 80, plantelId: 3, matricula: 'A010', curp: 'CURP-PRIVADA',
        fechaNacimiento: '2010-01-01', tutorNombre: 'Tutor privado', tutorTelefono: '5550000000',
        direccion: 'Dirección privada', estatus: 'ACTIVO',
        usuario: { nombre: 'Ana', apellidoPaterno: 'López', nombreCompleto: 'Ana López', email: 'ana@example.invalid' },
      },
    };
    const query = {
      leftJoinAndSelect: jest.fn().mockReturnThis(), where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(), andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([cargo]),
    };
    const pagosQuery = {
      select: jest.fn().mockReturnThis(), addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(), andWhere: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(), getRawMany: jest.fn().mockResolvedValue([]),
    };
    const scope = { resolverFiltro: jest.fn().mockResolvedValue([3]) };
    const service = new CargosService(
      { createQueryBuilder: jest.fn().mockReturnValue(query) } as any,
      { createQueryBuilder: jest.fn().mockReturnValue(pagosQuery) } as any,
      {} as any, {} as any, {} as any, {} as any, {} as any, scope as any, {} as any,
    );

    const respuesta = await service.adeudos({ sub: 4, roles: ['FINANZAS'] } as any);

    expect(respuesta[0].alumno).toMatchObject({ matricula: 'A010', usuario: { nombreCompleto: 'Ana López' } });
    for (const datoPrivado of ['CURP-PRIVADA', 'Tutor privado', '5550000000', 'Dirección privada', 'ana@example.invalid']) {
      expect(JSON.stringify(respuesta)).not.toContain(datoPrivado);
    }
  });
});

describe('CargosService.aplicarRecargos', () => {
  it('calcula (monto - descuento) x porcentaje/100 en cargos vencidos sin recargo previo', async () => {
    const cargo = {
      id: 1, monto: 1000, descuento: 100, recargo: 0, estatus: 'PENDIENTE',
      fechaVencimiento: '2020-01-01', alumno: { plantelId: 4 },
    };
    const qb = {
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([cargo]),
    };
    const cargosRepo = {
      createQueryBuilder: jest.fn().mockReturnValue(qb),
      findOne: jest.fn().mockResolvedValue(cargo),
      save: jest.fn().mockResolvedValue(undefined),
    };
    const bitacora = { registrar: jest.fn().mockResolvedValue(undefined) };
    const scope = { resolverFiltro: jest.fn().mockResolvedValue(null) };
    const manager = { getRepository: jest.fn().mockReturnValue(cargosRepo) };
    const dataSource = { transaction: jest.fn((fn) => fn(manager)) };
    const service = new CargosService(
      cargosRepo as any, {} as any, {} as any, {} as any, {} as any, {} as any,
      bitacora as any, scope as any, dataSource as any,
    );
    const user = { sub: 1, roles: ['FINANZAS'] } as any;

    const resultado = await service.aplicarRecargos({ porcentaje: 10 }, user);

    expect(cargo.recargo).toBe(90); // (1000 - 100) * 10 / 100
    expect(resultado).toEqual({ aplicados: 1, porcentaje: 10 });
    expect(bitacora.registrar).toHaveBeenCalledWith(
      1, 'APLICAR_RECARGOS', 'cargo', null, '10% a 1 cargos', 4, manager,
    );
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
    const manager = { getRepository: jest.fn().mockReturnValue(cargosRepo) };
    const dataSource = { transaction: jest.fn((fn) => fn(manager)) };
    const service = new CargosService(
      cargosRepo as any, {} as any, {} as any, {} as any, alumnosService as any,
      conceptos as any, bitacora as any, {} as any, dataSource as any,
    );
    const user = { sub: 7, roles: ['FINANZAS'] } as any;
    const dto = { alumnoId: 10, conceptoId: 5, descripcion: 'Cargo', monto: 100 } as any;

    await service.crear(dto, user);

    expect(alumnosService.obtener).toHaveBeenCalledWith(10, user);
    expect(bitacora.registrar).toHaveBeenCalledWith(
      7, 'CREAR_CARGO', 'cargo', 99, 'Cargo $100', 3, manager,
    );
  });

  it('rechaza descuento mayor al monto antes de iniciar la transacción', async () => {
    const dataSource = { transaction: jest.fn() };
    const service = new CargosService(
      {} as any, {} as any, {} as any, {} as any, {} as any,
      {} as any, {} as any, {} as any, dataSource as any,
    );

    await expect(service.crear({
      alumnoId: 10, conceptoId: 5, descripcion: 'Cargo', monto: 100, descuento: 101,
    }, { sub: 7, roles: ['FINANZAS'] } as any)).rejects.toThrow('el descuento no puede excederlo');
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });
});

describe('DTO financieros', () => {
  it('rechaza meses imposibles, fechas inválidas y centavos fuera de escala', async () => {
    const cargo = plainToInstance(CrearCargoDto, {
      alumnoId: 1, conceptoId: 2, descripcion: 'Cargo', monto: 100.001,
      fechaVencimiento: '2026-02-30', periodo: '2026-13',
    });
    const colegiatura = plainToInstance(GenerarColegiaturasDto, { cicloId: 1, periodo: '2026-00' });

    const erroresCargo = await validate(cargo);
    expect(erroresCargo.map((error) => error.property)).toEqual(expect.arrayContaining([
      'monto', 'fechaVencimiento', 'periodo',
    ]));
    expect((await validate(colegiatura)).map((error) => error.property)).toContain('periodo');
  });
});

describe('CargosService.generarColegiaturas', () => {
  const crearServicio = (guardar: jest.Mock) => {
    const grupos = { find: jest.fn().mockResolvedValue([{ id: 4, plantelId: 2 }]) };
    const inscripciones = { find: jest.fn().mockResolvedValue([
      { alumnoId: 8, alumno: { plantelId: 2, estatus: 'ACTIVO' } },
      { alumnoId: 9, alumno: { plantelId: 2, estatus: 'ACTIVO' } },
    ]) };
    const cargos = {
      find: jest.fn().mockResolvedValue([]),
      create: jest.fn((dato) => dato),
      save: guardar,
    };
    const conceptos = { porClave: jest.fn().mockResolvedValue({ id: 5, montoBase: 100 }) };
    const scope = { resolverFiltro: jest.fn().mockResolvedValue([2]), condicion: jest.fn((ids) => ids) };
    const bitacora = { registrar: jest.fn().mockResolvedValue(undefined) };
    const manager = { getRepository: jest.fn().mockReturnValue(cargos) };
    const dataSource = { transaction: jest.fn((fn) => fn(manager)) };
    const service = new CargosService(
      cargos as any, {} as any, inscripciones as any, grupos as any, {} as any,
      conceptos as any, bitacora as any, scope as any, dataSource as any,
    );
    return { service, cargos, grupos, inscripciones, bitacora, manager };
  };

  it('usa ciclo en la consulta y una clave única estable por alumno, ciclo y periodo', async () => {
    const guardar = jest.fn().mockImplementation(async (cargo) => ({ id: 20, ...cargo }));
    const { service, cargos, grupos, bitacora, manager } = crearServicio(guardar);

    const resultado = await service.generarColegiaturas(
      { cicloId: 3, periodo: '2026-09' } as any,
      { sub: 1, roles: ['FINANZAS'] } as any,
    );

    expect(cargos.find).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ conceptoId: 5, cicloId: 3, periodo: '2026-09' }),
    }));
    expect(grupos.find).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ cicloId: 3, activo: true }),
    }));
    expect(guardar.mock.calls.map(([cargo]) => cargo.claveGeneracion)).toEqual([
      'COLEGIATURA:3:8:2026-09', 'COLEGIATURA:3:9:2026-09',
    ]);
    expect(resultado).toMatchObject({ generados: 2, omitidos: 0 });
    expect(bitacora.registrar).toHaveBeenCalledWith(
      1, 'GENERAR_COLEGIATURA', 'cargo', 20,
      'periodo=2026-09 monto=100', 2, manager,
    );
  });

  it('cuenta un conflicto único de otra ejecución como omitido sin duplicar cargos', async () => {
    const duplicado = Object.assign(new Error('duplicate key'), { code: 'ER_DUP_ENTRY' });
    const guardar = jest.fn().mockRejectedValueOnce(duplicado).mockImplementation(async (cargo) => ({ id: 21, ...cargo }));
    const { service, bitacora, manager } = crearServicio(guardar);

    const resultado = await service.generarColegiaturas(
      { cicloId: 3, periodo: '2026-09' } as any,
      { sub: 1, roles: ['FINANZAS'] } as any,
    );

    expect(resultado).toMatchObject({ generados: 1, omitidos: 1 });
    expect(bitacora.registrar).toHaveBeenCalledWith(
      1, 'GENERAR_COLEGIATURA', 'cargo', 21,
      'periodo=2026-09 monto=100', 2, manager,
    );
  });

  it('no genera colegiaturas para alumnos dados de baja', async () => {
    const guardar = jest.fn();
    const { service, inscripciones } = crearServicio(guardar);
    inscripciones.find.mockResolvedValue([
      { alumnoId: 8, alumno: { plantelId: 2, estatus: 'BAJA' } },
    ]);

    const resultado = await service.generarColegiaturas(
      { cicloId: 3, periodo: '2026-09' } as any,
      { sub: 1, roles: ['FINANZAS'] } as any,
    );

    expect(resultado).toEqual({ generados: 0, omitidos: 0 });
    expect(guardar).not.toHaveBeenCalled();
  });
});
