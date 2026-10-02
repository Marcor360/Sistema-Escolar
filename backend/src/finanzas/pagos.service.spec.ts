import { BadRequestException, ConflictException } from '@nestjs/common';
import { BitacoraFinanciera } from '../entities/bitacora-financiera.entity';
import { Cargo } from '../entities/cargo.entity';
import { OrdenPago } from '../entities/orden-pago.entity';
import { Pago } from '../entities/pago.entity';
import { PagosService } from './pagos.service';

const user = { sub: 77, roles: ['FINANZAS'] } as any;
const alumno = { id: 8, plantelId: 2 } as any;

function servicioTransaccional(options: {
  cargo?: any;
  orden?: any;
  pagoExistente?: any;
  saldo?: number;
} = {}) {
  const cargo = options.cargo ?? { id: 3, alumnoId: 8, estatus: 'PENDIENTE' };
  const orden = options.orden ?? {
    id: 12, alumnoId: 8, cargoId: 3, monto: 125, estatus: 'PENDIENTE', alumno,
  };
  const pagosRepo = {
    findOne: jest.fn().mockResolvedValue(options.pagoExistente ?? null),
    create: jest.fn((datos) => datos),
    save: jest.fn(async (datos) => ({ id: 40, ...datos })),
  };
  const cargoRepo = { findOne: jest.fn().mockResolvedValue(cargo) };
  const ordenRepo = {
    findOne: jest.fn().mockResolvedValue(orden),
    save: jest.fn(async (datos) => datos),
  };
  const bitacoraRepo = { insert: jest.fn().mockResolvedValue(undefined) };
  const manager = {
    getRepository: jest.fn((entity) => {
      if (entity === Cargo) return cargoRepo;
      if (entity === OrdenPago) return ordenRepo;
      if (entity === Pago) return pagosRepo;
      if (entity === BitacoraFinanciera) return bitacoraRepo;
      throw new Error(`Repositorio inesperado: ${entity.name}`);
    }),
  };
  const dataSource = { transaction: jest.fn((callback) => callback(manager as any)) };
  const cargos = {
    saldoDeCargo: jest.fn().mockResolvedValue(options.saldo ?? 125),
    recalcularEstatus: jest.fn().mockResolvedValue(undefined),
  };
  const alumnos = { obtener: jest.fn().mockResolvedValue(alumno) };
  const service = new PagosService({} as any, alumnos as any, cargos as any, {} as any, dataSource as any);
  return { service, cargo, orden, pagosRepo, cargoRepo, ordenRepo, bitacoraRepo, manager, cargos, alumnos };
}

describe('PagosService.registrarManual', () => {
  it('rechaza un pago que excede el saldo y no registra ningún movimiento', async () => {
    const ctx = servicioTransaccional({ saldo: 100 });
    ctx.ordenRepo.findOne.mockResolvedValue(null);

    await expect(ctx.service.registrarManual({
      alumnoId: 8, cargoId: 3, monto: 100.01, metodo: 'EFECTIVO',
    } as any, user)).rejects.toBeInstanceOf(BadRequestException);

    expect(ctx.pagosRepo.save).not.toHaveBeenCalled();
    expect(ctx.bitacoraRepo.insert).not.toHaveBeenCalled();
    expect(ctx.cargoRepo.findOne).toHaveBeenCalledWith({
      where: { id: 3 }, lock: { mode: 'pessimistic_write' },
    });
  });

  it('acepta un pago exacto al saldo y recalcula el estatus dentro de la transacción', async () => {
    const ctx = servicioTransaccional({ saldo: 100 });
    ctx.ordenRepo.findOne.mockResolvedValue(null);

    await expect(ctx.service.registrarManual({
      alumnoId: 8, cargoId: 3, monto: 100, metodo: 'TRANSFERENCIA',
    } as any, user)).resolves.toMatchObject({ monto: 100, cargoId: 3, estatus: 'CONFIRMADO' });

    expect(ctx.cargos.recalcularEstatus).toHaveBeenCalledWith(3, ctx.manager);
    expect(ctx.bitacoraRepo.insert).toHaveBeenCalledTimes(1);
  });

  it('no permite un pago manual mientras una orden de pasarela reserva el cargo', async () => {
    const ctx = servicioTransaccional();
    ctx.ordenRepo.findOne.mockResolvedValue({ id: 12, estatus: 'PENDIENTE' });

    await expect(ctx.service.registrarManual({
      alumnoId: 8, cargoId: 3, monto: 50, metodo: 'EFECTIVO',
    } as any, user)).rejects.toBeInstanceOf(ConflictException);

    expect(ctx.pagosRepo.save).not.toHaveBeenCalled();
  });
});

describe('PagosService.registrarDePasarela', () => {
  const orden = {
    id: 12, alumnoId: 8, cargoId: 3, monto: 125, estatus: 'PENDIENTE', alumno,
  } as any;

  it('reutiliza el pago si Openpay reenvía el webhook', async () => {
    const pago = { id: 40, ordenPagoId: 12, cargoId: 3 };
    const ctx = servicioTransaccional({ pagoExistente: pago });

    await expect(ctx.service.registrarDePasarela(orden, 125, 'ch_12')).resolves.toEqual({
      pago, creado: false, aplicado: true,
    });
    expect(ctx.pagosRepo.save).not.toHaveBeenCalled();
    expect(ctx.cargos.recalcularEstatus).toHaveBeenCalledWith(3, ctx.manager);
  });

  it('registra el cobro recibido como no aplicado si el saldo ya fue consumido', async () => {
    const ctx = servicioTransaccional({ saldo: 50 });

    const resultado = await ctx.service.registrarDePasarela(orden, 125, 'ch_12');

    expect(resultado).toMatchObject({ creado: true, aplicado: false });
    expect(ctx.pagosRepo.save).toHaveBeenCalledWith(expect.objectContaining({
      alumnoId: 8, cargoId: null, ordenPagoId: 12, monto: 125, estatus: 'CONFIRMADO',
    }));
    expect(ctx.orden.estatus).toBe('COMPLETADA');
    expect(ctx.cargos.recalcularEstatus).not.toHaveBeenCalled();
    expect(ctx.bitacoraRepo.insert).toHaveBeenCalledWith(expect.objectContaining({
      accion: 'PAGO_PASARELA_NO_APLICADO',
    }));
  });

  it('rechaza un importe confirmado que no coincide con la orden', async () => {
    const ctx = servicioTransaccional();

    await expect(ctx.service.registrarDePasarela(orden, 124, 'ch_12')).rejects.toBeInstanceOf(BadRequestException);

    expect(ctx.pagosRepo.save).not.toHaveBeenCalled();
    expect(ctx.ordenRepo.save).not.toHaveBeenCalled();
  });
});
