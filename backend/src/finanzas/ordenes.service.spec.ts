import { BadRequestException } from '@nestjs/common';
import { OrdenesService } from './ordenes.service';

const alumnoUser = { sub: 5, email: 'alumno@escuela.mx', nombre: 'Alumno', roles: ['ALUMNO'] } as any;
const finanzasUser = { sub: 77, email: 'finanzas@escuela.mx', nombre: 'Finanzas', roles: ['FINANZAS'] } as any;
const dataSourceFor = (_ordenes: any) => {
  let orden: any;
  return { transaction: (work: any) => work({
    getRepository: (entity: any) => entity.name === 'Cargo'
      ? { findOne: jest.fn().mockResolvedValue({ id: 1 }) }
      : { findOne: jest.fn(async () => orden ?? null), create: (d: any) => d,
        save: jest.fn(async (d: any) => { orden = { id: 19, ...orden, ...d }; return orden; }) },
  }) };
};

describe('OrdenesService.crear', () => {
  it('rechaza a un alumno creando una orden de un cargo ajeno', async () => {
    const cargos = { validarAcceso: jest.fn().mockResolvedValue(undefined), obtener: jest.fn().mockResolvedValue({ id: 1, alumnoId: 999 }), saldoDeCargo: jest.fn() };
    const alumnos = { obtenerPorUsuario: jest.fn().mockResolvedValue({ id: 5 }), obtener: jest.fn() };
    const repo = {};
    const service = new OrdenesService(repo as any, alumnos as any, cargos as any, {} as any, {} as any, {} as any, {} as any, dataSourceFor(repo) as any);

    await expect(service.crear(1, alumnoUser)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rechaza crear una orden si el cargo ya no tiene saldo pendiente', async () => {
    const cargos = { validarAcceso: jest.fn().mockResolvedValue(undefined), obtener: jest.fn().mockResolvedValue({ id: 1, alumnoId: 5 }), saldoDeCargo: jest.fn().mockResolvedValue(0) };
    const alumnos = { obtenerPorUsuario: jest.fn().mockResolvedValue({ id: 5 }), obtener: jest.fn() };
    const repo = {};
    const service = new OrdenesService(repo as any, alumnos as any, cargos as any, {} as any, {} as any, {} as any, {} as any, dataSourceFor(repo) as any);

    await expect(service.crear(1, alumnoUser)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('para personal (FINANZAS), valida el plantel de origen del cargo', async () => {
    const cargo = {
      id: 1, alumnoId: 10, plantelId: 2, descripcion: 'Colegiatura',
      alumno: { plantelId: 2, usuario: { nombreCompleto: 'X Y', email: 'x@escuela.mx' } },
    };
    const cargos = { validarAcceso: jest.fn().mockResolvedValue(undefined), obtener: jest.fn().mockResolvedValue(cargo), saldoDeCargo: jest.fn().mockResolvedValue(500) };
    const alumnos = {
      obtenerPorUsuario: jest.fn().mockRejectedValue(new Error('el usuario no tiene expediente de alumno')),
      obtener: jest.fn().mockResolvedValue({ id: 10 }),
    };
    const ordenesRepo = { create: jest.fn((d) => d), save: jest.fn((d) => Promise.resolve({ id: 1, ...d })) };
    const openpay = { crearCargoRedirect: jest.fn().mockResolvedValue({ id: 'ch_1', order_id: 'ORD-19', amount: 500, currency: 'MXN', transaction_type: 'charge', payment_method: { url: 'http://pago' }, due_date: null }) };
    const bitacora = { registrar: jest.fn().mockResolvedValue(undefined) };
    const service = new OrdenesService(ordenesRepo as any, alumnos as any, cargos as any, {} as any, openpay as any, {} as any, bitacora as any, dataSourceFor(ordenesRepo) as any);

    await service.crear(1, finanzasUser);

    expect(cargos.validarAcceso).toHaveBeenCalledWith(cargo, finanzasUser);
  });

  it('marca la orden local como fallida si Openpay rechaza la creación', async () => {
    const error: any = new Error('Openpay rechazó la solicitud');
    error.response = { status: 400 };
    const cargo = {
      id: 1, alumnoId: 10, plantelId: 2, descripcion: 'Colegiatura',
      alumno: { plantelId: 2, usuario: { nombreCompleto: 'X Y', email: 'x@escuela.mx' } },
    };
    const cargos = { validarAcceso: jest.fn().mockResolvedValue(undefined), obtener: jest.fn().mockResolvedValue(cargo), saldoDeCargo: jest.fn().mockResolvedValue(500) };
    const alumnos = {
      obtenerPorUsuario: jest.fn().mockRejectedValue(new Error('sin expediente')),
      obtener: jest.fn().mockResolvedValue({ id: 10 }),
    };
    const ordenes = {
      create: jest.fn((datos) => datos),
      save: jest.fn().mockImplementation((orden) => Promise.resolve({ id: 19, ...orden })),
    };
    const openpay = { crearCargoRedirect: jest.fn().mockRejectedValue(error) };
    const bitacora = { registrar: jest.fn().mockResolvedValue(undefined) };
    const service = new OrdenesService(
      ordenes as any, alumnos as any, cargos as any, {} as any, openpay as any, {} as any, bitacora as any, dataSourceFor(ordenes) as any,
    );

    await expect(service.crear(1, finanzasUser)).rejects.toBe(error);
    expect(ordenes.save).toHaveBeenCalledTimes(1);
    expect(ordenes.save.mock.calls[0][0].estatus).toBe('FALLIDA');
    expect(bitacora.registrar).toHaveBeenCalledWith(
      77, 'FALLO_CREAR_ORDEN', 'orden_pago', 19,
      'ORD-19: fallo al crear cargo Openpay; requiere conciliación', 2,
    );
  });

  it('conserva CREADA ante timeout ambiguo para no duplicar el cargo', async () => {
    const cargo = { id: 1, alumnoId: 10, plantelId: 2, descripcion: 'Colegiatura', alumno: { plantelId: 2, usuario: { nombreCompleto: 'X Y', email: 'x@escuela.mx' } } };
    const cargos = { validarAcceso: jest.fn().mockResolvedValue(undefined), obtener: jest.fn().mockResolvedValue(cargo), saldoDeCargo: jest.fn().mockResolvedValue(500) };
    const alumnos = { obtenerPorUsuario: jest.fn().mockRejectedValue(new Error()), obtener: jest.fn().mockResolvedValue({ id: 10 }) };
    const ordenes = { create: jest.fn((d) => d), save: jest.fn() };
    const timeout = new Error('timeout');
    const openpay = { crearCargoRedirect: jest.fn().mockRejectedValue(timeout) };
    const service = new OrdenesService(ordenes as any, alumnos as any, cargos as any, {} as any,
      openpay as any, {} as any, { registrar: jest.fn().mockResolvedValue(undefined) } as any, dataSourceFor(ordenes) as any);

    await expect(service.crear(1, finanzasUser)).rejects.toBe(timeout);
    expect(ordenes.save).not.toHaveBeenCalled();
  });
});

describe('OrdenesService.procesarWebhook', () => {
  it('confirma el pago pero no repite la notificación en un webhook duplicado', async () => {
    const orden = {
      id: 12,
      idExterno: 'ch_12',
      alumno: { usuarioId: 8, plantelId: 2 },
      monto: 125,
      descripcion: 'Colegiatura',
      estatus: 'PENDIENTE',
    };
    const ordenes = {
      findOne: jest.fn().mockResolvedValue(orden),
      save: jest.fn().mockResolvedValue(orden),
    };
    const pagos = {
      registrarDePasarela: jest.fn().mockResolvedValue({ pago: { monto: 125 }, creado: false }),
    };
    const notificaciones = { crear: jest.fn() };
    const service = new OrdenesService(
      ordenes as any, {} as any, {} as any, pagos as any, {} as any,
      notificaciones as any, {} as any, {} as any,
    );

    await expect(service.procesarWebhook({
      type: 'charge.succeeded', transaction: { id: 'ch_12', order_id: 'ORD-12', amount: 125, currency: 'MXN', transaction_type: 'charge', status: 'completed' },
    })).resolves.toEqual({ ok: true });

    expect(pagos.registrarDePasarela).toHaveBeenCalledTimes(1);
    expect(orden.estatus).toBe('PENDIENTE');
    expect(ordenes.save).not.toHaveBeenCalled();
    expect(notificaciones.crear).not.toHaveBeenCalled();
  });

  it('ignora un webhook con importe alterado', async () => {
    const orden = { id: 12, idExterno: 'ch_12', monto: 125, estatus: 'PENDIENTE' };
    const pagos = { registrarDePasarela: jest.fn() };
    const service = new OrdenesService({ findOne: jest.fn().mockResolvedValue(orden) } as any,
      {} as any, {} as any, pagos as any, {} as any, {} as any, {} as any, {} as any);
    await expect(service.procesarWebhook({ type: 'charge.succeeded', transaction: {
      id: 'ch_12', order_id: 'ORD-12', amount: 0.01, currency: 'MXN', transaction_type: 'charge', status: 'completed',
    } })).resolves.toEqual({ ok: true, ignorado: true });
    expect(pagos.registrarDePasarela).not.toHaveBeenCalled();
  });
});
