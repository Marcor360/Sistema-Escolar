import type { JwtUser } from '../common/current-user.decorator';
import type { OrdenPago } from '../entities/orden-pago.entity';
import type { EntityManager, Repository, DataSource } from 'typeorm';
import type { AlumnosService } from '../alumnos/alumnos.service';
import type { CargosService } from './cargos.service';
import type { PagosService } from './pagos.service';
import type { OpenpayService } from './openpay.service';
import type { NotificacionesService } from '../notificaciones/notificaciones.service';
import type { BitacoraFinancieraService } from './bitacora-financiera.service';
import { stub } from '../test-utils/stub';
import { BadRequestException } from '@nestjs/common';
import { OrdenesService } from './ordenes.service';

const alumnoUser = stub<JwtUser>({ sub: 5, email: 'alumno@escuela.mx', nombre: 'Alumno', roles: ['ALUMNO'] });
const finanzasUser = stub<JwtUser>({ sub: 77, email: 'finanzas@escuela.mx', nombre: 'Finanzas', roles: ['FINANZAS'] });
const dataSourceFor = () => {
  type Orden = Partial<OrdenPago>;
  let orden: Orden | undefined;
  const manager = stub<EntityManager>({
    getRepository: jest.fn((entity: { name: string }) =>
      entity.name === 'Cargo'
        ? { findOne: jest.fn().mockResolvedValue({ id: 1 }) }
        : {
            findOne: jest.fn(async () => orden ?? null),
            create: (datos: Orden) => datos,
            save: jest.fn(async (datos: Orden) => {
              orden = { id: 19, ...orden, ...datos };
              return orden;
            }),
          },
    ),
  });
  return { transaction: jest.fn((work: (manager: EntityManager) => Promise<unknown>) => work(manager)) };
};

describe('OrdenesService.crear', () => {
  it('rechaza a un alumno creando una orden de un cargo ajeno', async () => {
    const cargos = {
      validarAcceso: jest.fn().mockResolvedValue(undefined),
      obtener: jest.fn().mockResolvedValue({ id: 1, alumnoId: 999 }),
      saldoDeCargo: jest.fn(),
    };
    const alumnos = { obtenerPorUsuario: jest.fn().mockResolvedValue({ id: 5 }), obtener: jest.fn() };
    const repo = {};
    const service = new OrdenesService(
      stub<Repository<OrdenPago>>(repo),
      stub<AlumnosService>(alumnos),
      stub<CargosService>(cargos),
      stub<PagosService>({}),
      stub<OpenpayService>({}),
      stub<NotificacionesService>({}),
      stub<BitacoraFinancieraService>({}),
      stub<DataSource>(dataSourceFor()),
    );

    await expect(service.crear(1, alumnoUser)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rechaza crear una orden si el cargo ya no tiene saldo pendiente', async () => {
    const cargos = {
      validarAcceso: jest.fn().mockResolvedValue(undefined),
      obtener: jest.fn().mockResolvedValue({ id: 1, alumnoId: 5, alumno: { usuario: { email: 'alumno@example.invalid' } } }),
      saldoDeCargo: jest.fn().mockResolvedValue(0),
    };
    const alumnos = { obtenerPorUsuario: jest.fn().mockResolvedValue({ id: 5 }), obtener: jest.fn() };
    const repo = {};
    const service = new OrdenesService(
      stub<Repository<OrdenPago>>(repo),
      stub<AlumnosService>(alumnos),
      stub<CargosService>(cargos),
      stub<PagosService>({}),
      stub<OpenpayService>({}),
      stub<NotificacionesService>({}),
      stub<BitacoraFinancieraService>({}),
      stub<DataSource>(dataSourceFor()),
    );

    await expect(service.crear(1, alumnoUser)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('para personal (FINANZAS), valida el plantel de origen del cargo', async () => {
    const cargo = {
      id: 1,
      alumnoId: 10,
      plantelId: 2,
      descripcion: 'Colegiatura',
      alumno: { plantelId: 2, usuario: { nombreCompleto: 'X Y', email: 'x@escuela.mx' } },
    };
    const cargos = {
      validarAcceso: jest.fn().mockResolvedValue(undefined),
      obtener: jest.fn().mockResolvedValue(cargo),
      saldoDeCargo: jest.fn().mockResolvedValue(500),
    };
    const alumnos = {
      obtenerPorUsuario: jest.fn().mockRejectedValue(new Error('el usuario no tiene expediente de alumno')),
      obtener: jest.fn().mockResolvedValue({ id: 10 }),
    };
    const ordenesRepo = {
      create: jest.fn().mockImplementation((d: Record<string, unknown>) => d),
      save: jest.fn((d) => Promise.resolve({ id: 1, ...d })),
    };
    const openpay = {
      crearCargoRedirect: jest
        .fn()
        .mockResolvedValue({
          id: 'ch_1',
          order_id: 'ORD-19',
          amount: 500,
          currency: 'MXN',
          transaction_type: 'charge',
          payment_method: { url: 'http://pago' },
          due_date: null,
        }),
    };
    const bitacora = { registrar: jest.fn().mockResolvedValue(undefined) };
    const service = new OrdenesService(
      stub<Repository<OrdenPago>>(ordenesRepo),
      stub<AlumnosService>(alumnos),
      stub<CargosService>(cargos),
      stub<PagosService>({}),
      stub<OpenpayService>(openpay),
      stub<NotificacionesService>({}),
      stub<BitacoraFinancieraService>(bitacora),
      stub<DataSource>(dataSourceFor()),
    );

    await service.crear(1, finanzasUser);

    expect(cargos.validarAcceso).toHaveBeenCalledWith(cargo, finanzasUser);
  });

  it('marca la orden local como fallida si Openpay rechaza la creación', async () => {
    const error = Object.assign(new Error('Openpay rechazó la solicitud'), { response: { status: 400 } });
    const cargo = {
      id: 1,
      alumnoId: 10,
      plantelId: 2,
      descripcion: 'Colegiatura',
      alumno: { plantelId: 2, usuario: { nombreCompleto: 'X Y', email: 'x@escuela.mx' } },
    };
    const cargos = {
      validarAcceso: jest.fn().mockResolvedValue(undefined),
      obtener: jest.fn().mockResolvedValue(cargo),
      saldoDeCargo: jest.fn().mockResolvedValue(500),
    };
    const alumnos = {
      obtenerPorUsuario: jest.fn().mockRejectedValue(new Error('sin expediente')),
      obtener: jest.fn().mockResolvedValue({ id: 10 }),
    };
    const ordenes = {
      create: jest.fn().mockImplementation((datos: Record<string, unknown>) => datos),
      save: jest.fn().mockImplementation((orden) => Promise.resolve({ id: 19, ...orden })),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      findOne: jest.fn().mockResolvedValue(null),
    };
    const openpay = { crearCargoRedirect: jest.fn().mockRejectedValue(error) };
    const bitacora = { registrar: jest.fn().mockResolvedValue(undefined) };
    const service = new OrdenesService(
      stub<Repository<OrdenPago>>(ordenes),
      stub<AlumnosService>(alumnos),
      stub<CargosService>(cargos),
      stub<PagosService>({}),
      stub<OpenpayService>(openpay),
      stub<NotificacionesService>({}),
      stub<BitacoraFinancieraService>(bitacora),
      stub<DataSource>(dataSourceFor()),
    );

    await expect(service.crear(1, finanzasUser)).rejects.toBe(error);
    expect(ordenes.update).toHaveBeenCalledWith({ id: 19, estatus: 'CREADA' }, { estatus: 'FALLIDA' });
    expect(ordenes.save).not.toHaveBeenCalled();
    expect(bitacora.registrar).toHaveBeenCalledWith(
      77,
      'FALLO_CREAR_ORDEN',
      'orden_pago',
      19,
      'ORD-19: fallo al crear cargo Openpay; requiere conciliación',
      2,
    );
  });

  it('conserva CREADA ante timeout ambiguo para no duplicar el cargo', async () => {
    const cargo = {
      id: 1,
      alumnoId: 10,
      plantelId: 2,
      descripcion: 'Colegiatura',
      alumno: { plantelId: 2, usuario: { nombreCompleto: 'X Y', email: 'x@escuela.mx' } },
    };
    const cargos = {
      validarAcceso: jest.fn().mockResolvedValue(undefined),
      obtener: jest.fn().mockResolvedValue(cargo),
      saldoDeCargo: jest.fn().mockResolvedValue(500),
    };
    const alumnos = {
      obtenerPorUsuario: jest.fn().mockRejectedValue(new Error()),
      obtener: jest.fn().mockResolvedValue({ id: 10 }),
    };
    const ordenes = {
      create: jest.fn().mockImplementation((d: Record<string, unknown>) => d),
      save: jest.fn(),
      findOne: jest.fn().mockResolvedValue(null),
    };
    const timeout = new Error('timeout');
    const openpay = { crearCargoRedirect: jest.fn().mockRejectedValue(timeout) };
    const service = new OrdenesService(
      stub<Repository<OrdenPago>>(ordenes),
      stub<AlumnosService>(alumnos),
      stub<CargosService>(cargos),
      stub<PagosService>({}),
      stub<OpenpayService>(openpay),
      stub<NotificacionesService>({}),
      stub<BitacoraFinancieraService>({ registrar: jest.fn().mockResolvedValue(undefined) }),
      stub<DataSource>(dataSourceFor()),
    );

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
      stub<Repository<OrdenPago>>(ordenes),
      stub<AlumnosService>({}),
      stub<CargosService>({}),
      stub<PagosService>(pagos),
      stub<OpenpayService>({}),
      stub<NotificacionesService>(notificaciones),
      stub<BitacoraFinancieraService>({}),
      stub<DataSource>({}),
    );

    await expect(
      service.procesarWebhook({
        type: 'charge.succeeded',
        transaction: {
          id: 'ch_12',
          order_id: 'ORD-12',
          amount: 125,
          currency: 'MXN',
          transaction_type: 'charge',
          status: 'completed',
        },
      }),
    ).resolves.toEqual({ ok: true });

    expect(pagos.registrarDePasarela).toHaveBeenCalledTimes(1);
    expect(orden.estatus).toBe('PENDIENTE');
    expect(ordenes.save).not.toHaveBeenCalled();
    expect(notificaciones.crear).not.toHaveBeenCalled();
  });

  it('ignora un webhook con importe alterado', async () => {
    const orden = { id: 12, idExterno: 'ch_12', monto: 125, estatus: 'PENDIENTE' };
    const pagos = { registrarDePasarela: jest.fn() };
    const service = new OrdenesService(
      stub<Repository<OrdenPago>>({ findOne: jest.fn().mockResolvedValue(orden) }),
      stub<AlumnosService>({}),
      stub<CargosService>({}),
      stub<PagosService>(pagos),
      stub<OpenpayService>({}),
      stub<NotificacionesService>({}),
      stub<BitacoraFinancieraService>({}),
      stub<DataSource>({}),
    );
    await expect(
      service.procesarWebhook({
        type: 'charge.succeeded',
        transaction: {
          id: 'ch_12',
          order_id: 'ORD-12',
          amount: 0.01,
          currency: 'MXN',
          transaction_type: 'charge',
          status: 'completed',
        },
      }),
    ).resolves.toEqual({ ok: true, ignorado: true });
    expect(pagos.registrarDePasarela).not.toHaveBeenCalled();
  });
});
