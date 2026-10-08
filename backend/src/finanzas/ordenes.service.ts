import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { OrdenPago } from '../entities/orden-pago.entity';
import { Cargo } from '../entities/cargo.entity';
import { AlumnosService } from '../alumnos/alumnos.service';
import { NotificacionesService } from '../notificaciones/notificaciones.service';
import { CargosService } from './cargos.service';
import { PagosService } from './pagos.service';
import { OpenpayCharge, OpenpayService } from './openpay.service';
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

  async incidencias(user: JwtUser, pagina = 1) {
    // Obtener el alumno mediante su scope es obligatorio también al resolver una incidencia.
    const qb = this.ordenes.createQueryBuilder('o').innerJoinAndSelect('o.alumno', 'a').leftJoinAndSelect('a.usuario', 'u')
      .where('o.estatus IN (:...estatus)', { estatus: ['CREADA', 'PENDIENTE', 'FALLIDA'] });
    if (!user.roles.includes('SUPERADMIN')) qb.andWhere(
      'EXISTS (SELECT 1 FROM usuario_planteles up WHERE up.usuario_id = :actor AND up.plantel_id = o.plantel_id AND up.activo = :activo)',
      { actor: user.sub, activo: true });
    const [datos, total] = await qb.orderBy('o.createdAt', 'ASC').addOrderBy('o.id', 'ASC').skip((pagina - 1) * 20).take(20).getManyAndCount();
    return { datos: datos.map((o) => ({ id: o.id, alumnoId: o.alumnoId, matricula: o.alumno.matricula, monto: o.monto,
      fecha: o.createdAt, referencia: o.idExterno ?? `ORD-${o.id}`, estatus: o.estatus,
      motivo: o.estatus === 'CREADA' ? 'Creación ambigua: verificar con el proveedor' : 'Pendiente de resultado del proveedor' })), total, pagina, porPagina: 20 };
  }

  async conciliar(id: number, motivo: string, user: JwtUser) {
    if (!motivo.trim()) throw new BadRequestException('Indica el motivo de conciliación');
    const orden = await this.ordenes.findOne({ where: { id } });
    if (!orden) throw new NotFoundException('Orden no encontrada');
    await this.cargos.validarAcceso(orden, user);
    const charge = await this.openpay.buscarCargoPorOrden(`ORD-${id}`);
    if (!charge) throw new ConflictException('El proveedor todavía no confirma la orden; se conserva para revisión');
    if (charge.order_id !== `ORD-${id}` || Math.round(Number(charge.amount) * 100) !== Math.round(Number(orden.monto) * 100) ||
        charge.currency !== 'MXN' || charge.transaction_type !== 'charge') throw new ConflictException('La respuesta del proveedor no coincide con la orden');
    await this.aplicarRespuestaCargo(id, charge);
    if (charge.status === 'completed') await this.pagos.registrarDePasarela(orden, Number(charge.amount), charge.id);
    await this.bitacora.registrar(user.sub, 'CONCILIAR_ORDEN', 'orden_pago', id,
      `estado_proveedor=${charge.status}; ${motivo.trim()}`, orden.plantelId);
    return { id, estadoProveedor: charge.status, mensaje: 'Resultado del proveedor verificado y auditado' };
  }

  async crear(cargoId: number, user: JwtUser, clienteIp?: string) {
    const cargo = await this.cargos.obtener(cargoId);

    // Un alumno solo puede pagar sus propios cargos; FINANZAS puede generar para cualquiera
    const alumno = await this.alumnos.obtenerPorUsuario(user.sub).catch((): null => null);
    if (alumno) {
      if (cargo.alumnoId !== alumno.id) throw new BadRequestException('El cargo no pertenece al alumno autenticado');
    } else {
      await this.cargos.validarAcceso(cargo, user);
    }

    const reserva = await this.dataSource.transaction(async (manager) => {
      const cargos = manager.getRepository(Cargo);
      const cargoBloqueado = await cargos.findOne({
        where: { id: cargo.id }, lock: { mode: 'pessimistic_write' },
      });
      if (!cargoBloqueado) throw new NotFoundException('Cargo no encontrado');
      if (cargoBloqueado.estatus === 'CANCELADO') {
        throw new BadRequestException('No se puede generar una orden para un cargo cancelado');
      }
      const existente = await manager.getRepository(OrdenPago).findOne({
        where: [{ cargoId: cargo.id, estatus: 'CREADA' }, { cargoId: cargo.id, estatus: 'PENDIENTE' }],
      });
      if (existente) {
        return { orden: existente, previa: true };
      }
      const saldoActual = await this.cargos.saldoDeCargo(cargoBloqueado, manager);
      if (saldoActual <= 0) throw new BadRequestException('El cargo no tiene saldo pendiente');
      const repo = manager.getRepository(OrdenPago);
      return { orden: await repo.save(repo.create({
        alumnoId: cargo.alumnoId, plantelId: cargo.plantelId, cargoId: cargo.id, monto: saldoActual, descripcion: cargo.descripcion,
        estatus: 'CREADA',
      })), previa: false };
    });
    const orden = reserva.orden;
    if (orden.estatus === 'PENDIENTE' && orden.urlPago) return this.proyectarOrden(orden);
    if (reserva.previa && orden.id && orden.estatus === 'CREADA') {
      const existente = await this.openpay.buscarCargoPorOrden(`ORD-${orden.id}`).catch((): null => null);
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
      const respuesta = error && typeof error === 'object' && 'response' in error ? error.response : undefined;
      const status = respuesta && typeof respuesta === 'object' && 'status' in respuesta &&
        typeof respuesta.status === 'number' ? respuesta.status : undefined;
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
        cargo.plantelId,
      ).catch((): undefined => undefined);
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
      user.sub, 'CREAR_ORDEN', 'orden_pago', orden.id, `openpay=${charge.id} $${orden.monto}`, cargo.plantelId,
    );
    return this.proyectarOrden(actualizada);
  }

  private async aplicarRespuestaCargo(ordenId: number, charge: OpenpayCharge): Promise<OrdenPago> {
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
      const alumno = await this.alumnos.obtenerPorUsuario(user.sub).catch((): null => null);
      if (alumno) {
        if (orden.alumnoId !== alumno.id) throw new BadRequestException('La orden no pertenece al alumno autenticado');
      } else {
        await this.cargos.validarAcceso(orden, user);
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
  async procesarWebhook(payload: unknown) {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return { ok: true, ignorado: true };
    const evento = payload as Record<string, unknown>;
    if (evento.type === 'verification') return { ok: true };
    if (typeof evento.type !== 'string' || !evento.transaction || typeof evento.transaction !== 'object' ||
        Array.isArray(evento.transaction)) return { ok: true, ignorado: true };

    const tx = evento.transaction as Record<string, unknown>;
    const idExterno = typeof tx.id === 'string' && tx.id.length > 0 && tx.id.length <= 60 ? tx.id : null;
    const idOrden = typeof tx.order_id === 'string' ? tx.order_id : '';
    const monto = typeof tx.amount === 'number' ? tx.amount : Number.NaN;
    const estatusPasarela = typeof tx.status === 'string' ? tx.status : '';
    if (!idExterno || !Number.isFinite(monto) || monto <= 0) return { ok: true, ignorado: true };

    let orden = await this.ordenes.findOne({ where: { idExterno } });
    if (!orden) {
      const match = /^ORD-(\d+)$/.exec(idOrden);
      const localId = match ? Number(match[1]) : Number.NaN;
      if (Number.isSafeInteger(localId) && localId > 0) {
        orden = await this.ordenes.findOne({ where: { id: localId } });
      }
    }
    if (!orden) return { ok: true, ignorado: true };
    const expectedOrderId = `ORD-${orden.id}`;
    if (idOrden !== expectedOrderId || tx.currency !== 'MXN' || tx.transaction_type !== 'charge' ||
        Math.round(monto * 100) !== Math.round(Number(orden.monto) * 100)) {
      return { ok: true, ignorado: true };
    }
    if (orden.idExterno && orden.idExterno !== idExterno) return { ok: true, ignorado: true };
    if (['COMPLETADA', 'FALLIDA', 'CANCELADA', 'EXPIRADA'].includes(orden.estatus)) return { ok: true };

    // Persist only allowlisted operational metadata; never cardholder/address data.
    const payloadSeguro = JSON.stringify({
      type: evento.type,
      id: idExterno,
      order_id: idOrden,
      amount: monto,
      currency: 'MXN',
      transaction_type: 'charge',
      status: estatusPasarela,
    }).slice(0, 2000);

    switch (evento.type) {
      case 'charge.succeeded': {
        if (estatusPasarela !== 'completed') return { ok: true, ignorado: true };
        const resultado = await this.pagos.registrarDePasarela(orden, monto, idExterno, payloadSeguro);
        if (resultado.creado) {
          await this.notificaciones.crear(
            orden.alumno.usuarioId,
            resultado.aplicado ? 'Pago confirmado' : 'Pago recibido para revision',
            resultado.aplicado
              ? `Tu pago de $${resultado.pago.monto} MXN (${orden.descripcion}) fue confirmado.`
              : `Recibimos tu pago de $${resultado.pago.monto} MXN (${orden.descripcion}), pero el saldo cambio y Finanzas debe aplicarlo.`,
            'FINANCIERA',
          );
        }
        break;
      }
      case 'charge.failed':
        if (estatusPasarela !== 'failed') return { ok: true, ignorado: true };
        return this.actualizarEstatusWebhook(orden, 'FALLIDA', idExterno, payloadSeguro);
      case 'charge.cancelled':
        if (!['cancelled', 'canceled'].includes(estatusPasarela)) return { ok: true, ignorado: true };
        return this.actualizarEstatusWebhook(orden, 'CANCELADA', idExterno, payloadSeguro);
      case 'transaction.expired':
        if (estatusPasarela !== 'expired') return { ok: true, ignorado: true };
        return this.actualizarEstatusWebhook(orden, 'EXPIRADA', idExterno, payloadSeguro);
      default:
        return { ok: true, ignorado: true };
    }
    return { ok: true };
  }

  private async actualizarEstatusWebhook(
    orden: OrdenPago,
    estatus: 'FALLIDA' | 'CANCELADA' | 'EXPIRADA',
    idExterno: string,
    payload: string,
  ) {
    await this.dataSource.transaction(async (manager) => {
      if (orden.cargoId) {
        await manager.getRepository(Cargo).findOne({
          where: { id: orden.cargoId }, lock: { mode: 'pessimistic_write' },
        });
      }
      const repo = manager.getRepository(OrdenPago);
      const actual = await repo.findOne({ where: { id: orden.id }, lock: { mode: 'pessimistic_write' } });
      if (!actual || actual.estatus === 'COMPLETADA' || actual.estatus === 'FALLIDA' ||
          actual.estatus === 'CANCELADA' || actual.estatus === 'EXPIRADA') return;
      if (actual.idExterno && actual.idExterno !== idExterno) return;
      actual.estatus = estatus;
      actual.idExterno = idExterno;
      actual.payloadWebhook = payload;
      await repo.save(actual);
    });
    return { ok: true };
  }

}
