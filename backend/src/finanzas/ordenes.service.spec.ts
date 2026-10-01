import { BadRequestException } from '@nestjs/common';
import { OrdenesService } from './ordenes.service';

const alumnoUser = { sub: 5, email: 'alumno@escuela.mx', nombre: 'Alumno', roles: ['ALUMNO'] } as any;
const finanzasUser = { sub: 77, email: 'finanzas@escuela.mx', nombre: 'Finanzas', roles: ['FINANZAS'] } as any;

describe('OrdenesService.crear', () => {
  it('rechaza a un alumno creando una orden de un cargo ajeno', async () => {
    const cargos = { obtener: jest.fn().mockResolvedValue({ id: 1, alumnoId: 999 }), saldoDeCargo: jest.fn() };
    const alumnos = { obtenerPorUsuario: jest.fn().mockResolvedValue({ id: 5 }), obtener: jest.fn() };
    const service = new OrdenesService({} as any, alumnos as any, cargos as any, {} as any, {} as any, {} as any, {} as any);

    await expect(service.crear(1, alumnoUser)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rechaza crear una orden si el cargo ya no tiene saldo pendiente', async () => {
    const cargos = { obtener: jest.fn().mockResolvedValue({ id: 1, alumnoId: 5 }), saldoDeCargo: jest.fn().mockResolvedValue(0) };
    const alumnos = { obtenerPorUsuario: jest.fn().mockResolvedValue({ id: 5 }), obtener: jest.fn() };
    const service = new OrdenesService({} as any, alumnos as any, cargos as any, {} as any, {} as any, {} as any, {} as any);

    await expect(service.crear(1, alumnoUser)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('para personal (FINANZAS), valida el alumno del cargo vía alumnos.obtener (alcance de plantel)', async () => {
    const cargo = {
      id: 1, alumnoId: 10, descripcion: 'Colegiatura',
      alumno: { plantelId: 2, usuario: { nombreCompleto: 'X Y', email: 'x@escuela.mx' } },
    };
    const cargos = { obtener: jest.fn().mockResolvedValue(cargo), saldoDeCargo: jest.fn().mockResolvedValue(500) };
    const alumnos = {
      obtenerPorUsuario: jest.fn().mockRejectedValue(new Error('el usuario no tiene expediente de alumno')),
      obtener: jest.fn().mockResolvedValue({ id: 10 }),
    };
    const ordenesRepo = { create: jest.fn((d) => d), save: jest.fn((d) => Promise.resolve({ id: 1, ...d })) };
    const openpay = { crearCargoRedirect: jest.fn().mockResolvedValue({ id: 'ch_1', payment_method: { url: 'http://pago' }, due_date: null }) };
    const bitacora = { registrar: jest.fn().mockResolvedValue(undefined) };
    const service = new OrdenesService(ordenesRepo as any, alumnos as any, cargos as any, {} as any, openpay as any, {} as any, bitacora as any);

    await service.crear(1, finanzasUser);

    expect(alumnos.obtener).toHaveBeenCalledWith(10, finanzasUser);
  });

  it('marca la orden local como fallida si Openpay rechaza la creación', async () => {
    const error = new Error('Openpay no disponible');
    const cargo = {
      id: 1, alumnoId: 10, descripcion: 'Colegiatura',
      alumno: { plantelId: 2, usuario: { nombreCompleto: 'X Y', email: 'x@escuela.mx' } },
    };
    const cargos = { obtener: jest.fn().mockResolvedValue(cargo), saldoDeCargo: jest.fn().mockResolvedValue(500) };
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
      ordenes as any, alumnos as any, cargos as any, {} as any, openpay as any, {} as any, bitacora as any,
    );

    await expect(service.crear(1, finanzasUser)).rejects.toBe(error);
    expect(ordenes.save).toHaveBeenCalledTimes(2);
    expect(ordenes.save.mock.calls[1][0].estatus).toBe('FALLIDA');
    expect(bitacora.registrar).toHaveBeenCalledWith(
      77, 'FALLO_CREAR_ORDEN', 'orden_pago', 19,
      'ORD-19: fallo o timeout al crear cargo Openpay; requiere conciliación', 2,
    );
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
      notificaciones as any, {} as any,
    );

    await expect(service.procesarWebhook({
      type: 'charge.succeeded', transaction: { id: 'ch_12', amount: 125 },
    })).resolves.toEqual({ ok: true });

    expect(pagos.registrarDePasarela).toHaveBeenCalledTimes(1);
    expect(orden.estatus).toBe('COMPLETADA');
    expect(notificaciones.crear).not.toHaveBeenCalled();
  });
});
