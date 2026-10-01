import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { OrdenPago } from '../entities/orden-pago.entity';
import { Cargo } from '../entities/cargo.entity';
import { AlumnosService } from '../alumnos/alumnos.service';
import { NotificacionesService } from '../notificaciones/notificaciones.service';
import { CargosService } from './cargos.service';
import { PagosService } from './pagos.service';
import { OpenpayService } from './openpay.service';
import { BitacoraFinancieraService } from './bitacora-financiera.service';
import { JwtUser } from '../common/current-user.decorator';

/** Única responsabilidad: órdenes de pago en línea y su confirmación vía webhook. */
@Injectable()
export class OrdenesService {
  constructor(
    @InjectRepository(OrdenPago) private readonly ordenes: Repository<OrdenPago>,
    private readonly alumnos: AlumnosService,
    private readonly cargos: CargosService,
    private readonly pagos: PagosService,
    private readonly openpay: OpenpayService,
    private readonly notificaciones: NotificacionesService,
    private readonly bitacora: BitacoraFinancieraService,
    private readonly dataSource: DataSource,
  ) {}

  async crear(cargoId: number, user: JwtUser, clienteIp?: string) {
    const cargo = await this.cargos.obtener(cargoId);

    // Un alumno solo puede pagar sus propios cargos; FINANZAS puede generar para cualquiera
    const alumno = await this.alumnos.obtenerPorUsuario(user.sub).catch(() => null);
    if (alumno) {
      if (cargo.alumnoId !== alumno.id) throw new BadRequestException('El cargo no pertenece al alumno autenticado');
    } else {
      await this.alumnos.obtener(cargo.alumnoId, user);
    }

    const reserva = await this.dataSource.transaction(async (manager) => {
      const cargos = manager.getRepository(Cargo);
      await cargos.findOne({ where: { id: cargo.id }, lock: { mode: 'pessimistic_write' } });
      const existente = await manager.getRepository(OrdenPago).findOne({
        where: [{ cargoId: cargo.id, estatus: 'CREADA' }, { cargoId: cargo.id, estatus: 'PENDIENTE' }],
      });
      if (existente) {
        return { orden: existente, previa: true };
      }
      const saldoActual = await this.cargos.saldoDeCargo(cargo);
      if (saldoActual <= 0) throw new BadRequestException('El cargo no tiene saldo pendiente');
      const repo = manager.getRepository(OrdenPago);
      return { orden: await repo.save(repo.create({
        alumnoId: cargo.alumnoId, cargoId: cargo.id, monto: saldoActual, descripcion: cargo.descripcion,
        estatus: 'CREADA',
      })), previa: false };
    });
    const orden = reserva.orden;
    if (orden.estatus === 'PENDIENTE' && orden.urlPago) return this.proyectarOrden(orden);
    if (reserva.previa && orden.id && orden.estatus === 'CREADA') {
      const existente = await this.openpay.buscarCargoPorOrden(`ORD-${orden.id}`).catch(() => null);
      if (existente) {
        if (existente.order_id !== `ORD-${orden.id}` || Math.round(Number(existente.amount) * 100) !== Math.round(Number(orden.monto) * 100) ||
            existente.currency !== 'MXN' || existente.transaction_type !== 'charge') {
          throw new ConflictException('El cargo encontrado requiere revisión');
        }
        const conciliada = await this.aplicarRespuestaCargo(orden.id, existente);
        return this.proyectarOrden(conciliada);
      }
      // A reserved order is never submitted twice. Even if lookup is temporarily empty,
      // keep the stable order_id and require reconciliation before another attempt.
      throw new ConflictException('La orden existente requiere conciliación antes de reintentar');
    }
    if (reserva.previa) throw new ConflictException('La orden existente requiere conciliación antes de reintentar');

    let charge;
    try {
      charge = await this.openpay.crearCargoRedirect({
        monto: Number(orden.monto),
        descripcion: cargo.descripcion,
        ordenId: `ORD-${orden.id}`,
        clienteNombre: cargo.alumno.usuario.nombreCompleto,
        clienteEmail: cargo.alumno.usuario.email,
        clienteIp,
      });
    } catch (error) {
      // Un timeout/5xx no indica si Openpay alcanzó a crear el cargo. Se conserva CREADA.
      const status = (error as any)?.response?.status;
      if (status && status >= 400 && status < 500 && ![408, 409, 429].includes(status)) {
        orden.estatus = 'FALLIDA';
        await this.ordenes.save(orden);
      }
      await this.bitacora.registrar(
        user.sub,
        'FALLO_CREAR_ORDEN',
        'orden_pago',
        orden.id,
        `ORD-${orden.id}: fallo al crear cargo Openpay; requiere conciliación`,
        cargo.alumno.plantelId,
      ).catch(() => undefined);
      throw error;
    }

    if (charge.order_id !== `ORD-${orden.id}` || Math.round(Number(charge.amount) * 100) !== Math.round(Number(orden.monto) * 100) ||
        charge.currency !== 'MXN' || charge.transaction_type !== 'charge') {
      // The provider response does not prove a matching local intent. Keep reservation for reconciliation.
      await this.ordenes.save(orden);
      throw new ConflictException('Openpay devolvió un cargo que requiere conciliación');
    }
    const actualizada = await this.aplicarRespuestaCargo(orden.id, charge);
    await this.bitacora.registrar(
      user.sub, 'CREAR_ORDEN', 'orden_pago', orden.id, `openpay=${charge.id} $${orden.monto}`, cargo.alumno.plantelId,
    );
    return this.proyectarOrden(actualizada);
  }

  private async aplicarRespuestaCargo(ordenId: number, charge: any): Promise<OrdenPago> {
    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(OrdenPago);
      const actual = await repo.findOne({ where: { id: ordenId }, lock: { mode: 'pessimistic_write' } });
      if (!actual) throw new NotFoundException('Orden no encontrada');
      // A fast webhook may have completed the order while the provider POST was in flight.
      if (['COMPLETADA', 'FALLIDA', 'CANCELADA', 'EXPIRADA'].includes(actual.estatus)) return actual;
      actual.idExterno = charge.id;
      actual.urlPago = charge.payment_method?.url ?? null;
      actual.estatus = charge.status === 'failed' ? 'FALLIDA'
        : ['cancelled', 'canceled'].includes(charge.status) ? 'CANCELADA'
          : charge.status === 'expired' ? 'EXPIRADA' : 'PENDIENTE';
      actual.expiraEn = charge.due_date ? new Date(charge.due_date) : null;
      return repo.save(actual);
    });
  }

  async obtener(id: number, user?: JwtUser) {
    const orden = await this.ordenes.findOne({ where: { id } });
    if (!orden) throw new NotFoundException('Orden no encontrada');
    if (user) {
      const alumno = await this.alumnos.obtenerPorUsuario(user.sub).catch(() => null);
      if (alumno) {
        if (orden.alumnoId !== alumno.id) throw new BadRequestException('La orden no pertenece al alumno autenticado');
      } else {
        await this.alumnos.obtener(orden.alumnoId, user);
      }
    }
    return this.proyectarOrden(orden);
  }

  private proyectarOrden(orden: OrdenPago) {
    return {
      id: orden.id,
      alumnoId: orden.alumnoId,
      cargoId: orden.cargoId,
      monto: orden.monto,
      descripcion: orden.descripcion,
      proveedor: orden.proveedor,
      urlPago: orden.urlPago,
      estatus: orden.estatus,
      expiraEn: orden.expiraEn,
      createdAt: orden.createdAt,
      ...(orden.alumno ? {
        alumno: {
          id: orden.alumno.id,
          matricula: orden.alumno.matricula,
          usuario: orden.alumno.usuario ? {
            nombre: orden.alumno.usuario.nombre,
            nombreCompleto: orden.alumno.usuario.nombreCompleto,
          } : undefined,
        },
      } : {}),
    };
  }

  /** Webhook de Openpay: verificación inicial y eventos de transacción. */
  async procesarWebhook(payload: Record<string, any>) {
    if (payload?.type === 'verification') return { ok: true };

    const idExterno: string | undefined = payload?.transaction?.id;
    if (!idExterno) return { ok: true, ignorado: true };

    let orden = await this.ordenes.findOne({ where: { idExterno } });
    if (!orden && payload.transaction?.order_id?.startsWith('ORD-')) {
      const localId = Number(payload.transaction.order_id.slice(4));
      if (Number.isSafeInteger(localId)) orden = await this.ordenes.findOne({ where: { id: localId } });
    }
    if (!orden) return { ok: true, ignorado: true };
    const tx = payload.transaction;
    const expectedOrderId = `ORD-${orden.id}`;
    if (tx.order_id !== expectedOrderId || tx.currency !== 'MXN' || tx.transaction_type !== 'charge' ||
        !Number.isFinite(Number(tx.amount)) || Math.round(Number(tx.amount) * 100) !== Math.round(Number(orden.monto) * 100)) {
      return { ok: true, ignorado: true };
    }
    if (['COMPLETADA', 'FALLIDA', 'CANCELADA', 'EXPIRADA'].includes(orden.estatus)) return { ok: true };
    // Allowlist only operational metadata; never persist cardholder or address fields.
    orden.payloadWebhook = JSON.stringify({ type: payload.type, id: tx.id, order_id: tx.order_id,
      amount: tx.amount, currency: tx.currency, transaction_type: tx.transaction_type, status: tx.status }).slice(0, 2000);
    if (orden.idExterno && orden.idExterno !== idExterno) return { ok: true, ignorado: true };
    orden.idExterno = idExterno;

    switch (payload.type) {
      case 'charge.succeeded': {
        if (tx.status !== 'completed') return { ok: true, ignorado: true };
        const resultado = await this.pagos.registrarDePasarela(
          orden,
          Number(tx.amount),
          idExterno,
        );
        orden.estatus = 'COMPLETADA';
        await this.ordenes.save(orden);
        if (resultado.creado) {
          await this.notificaciones.crear(
            orden.alumno.usuarioId,
            'Pago confirmado',
            `Tu pago de $${resultado.pago.monto} MXN (${orden.descripcion}) fue confirmado.`,
            'FINANCIERA',
          );
        }
        break;
      }
      case 'charge.failed':
        if (tx.status !== 'failed') return { ok: true, ignorado: true };
        orden.estatus = 'FALLIDA';
        await this.ordenes.save(orden);
        break;
      case 'charge.cancelled':
        if (!['cancelled', 'canceled'].includes(tx.status)) return { ok: true, ignorado: true };
        orden.estatus = 'CANCELADA';
        await this.ordenes.save(orden);
        break;
      case 'transaction.expired':
        if (tx.status !== 'expired') return { ok: true, ignorado: true };
        orden.estatus = 'EXPIRADA';
        await this.ordenes.save(orden);
        break;
      default:
        await this.ordenes.save(orden);
    }
    return { ok: true };
  }
}
