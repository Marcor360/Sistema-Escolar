import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrdenPago } from '../entities/orden-pago.entity';
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
  ) {}

  async crear(cargoId: number, user: JwtUser) {
    const cargo = await this.cargos.obtener(cargoId);

    // Un alumno solo puede pagar sus propios cargos; FINANZAS puede generar para cualquiera
    const alumno = await this.alumnos.obtenerPorUsuario(user.sub).catch(() => null);
    if (alumno && cargo.alumnoId !== alumno.id) {
      throw new BadRequestException('El cargo no pertenece al alumno autenticado');
    }

    const saldo = await this.cargos.saldoDeCargo(cargo);
    if (saldo <= 0) throw new BadRequestException('El cargo no tiene saldo pendiente');

    const orden = await this.ordenes.save(
      this.ordenes.create({
        alumnoId: cargo.alumnoId,
        cargoId: cargo.id,
        monto: saldo,
        descripcion: cargo.descripcion,
      }),
    );

    const charge = await this.openpay.crearCargoRedirect({
      monto: saldo,
      descripcion: cargo.descripcion,
      ordenId: `ORD-${orden.id}`,
      clienteNombre: cargo.alumno.usuario.nombreCompleto,
      clienteEmail: cargo.alumno.usuario.email,
    });

    orden.idExterno = charge.id;
    orden.urlPago = charge.payment_method?.url ?? null;
    orden.estatus = 'PENDIENTE';
    orden.expiraEn = charge.due_date ? new Date(charge.due_date) : null;
    await this.ordenes.save(orden);
    await this.bitacora.registrar(user.sub, 'CREAR_ORDEN', 'orden_pago', orden.id, `openpay=${charge.id} $${saldo}`);
    return orden;
  }

  async obtener(id: number) {
    const orden = await this.ordenes.findOne({ where: { id } });
    if (!orden) throw new NotFoundException('Orden no encontrada');
    return orden;
  }

  /** Webhook de Openpay: verificación inicial y eventos de transacción. */
  async procesarWebhook(payload: Record<string, any>) {
    if (payload?.type === 'verification') {
      await this.bitacora.registrar(
        null, 'WEBHOOK_VERIFICACION', 'openpay', null,
        `verification_code=${payload.verification_code ?? ''}`,
      );
      return { ok: true };
    }

    const idExterno: string | undefined = payload?.transaction?.id;
    if (!idExterno) return { ok: true, ignorado: true };

    const orden = await this.ordenes.findOne({ where: { idExterno } });
    if (!orden) return { ok: true, ignorado: true };

    orden.payloadWebhook = JSON.stringify(payload).slice(0, 60000);

    switch (payload.type) {
      case 'charge.succeeded': {
        orden.estatus = 'COMPLETADA';
        await this.ordenes.save(orden);
        const pago = await this.pagos.registrarDePasarela(
          orden,
          Number(payload.transaction?.amount ?? orden.monto),
          idExterno,
        );
        await this.notificaciones.crear(
          orden.alumno.usuarioId,
          'Pago confirmado',
          `Tu pago de $${pago.monto} MXN (${orden.descripcion}) fue confirmado.`,
          'FINANCIERA',
        );
        break;
      }
      case 'charge.failed':
        orden.estatus = 'FALLIDA';
        await this.ordenes.save(orden);
        break;
      case 'charge.cancelled':
        orden.estatus = 'CANCELADA';
        await this.ordenes.save(orden);
        break;
      case 'transaction.expired':
        orden.estatus = 'EXPIRADA';
        await this.ordenes.save(orden);
        break;
      default:
        await this.ordenes.save(orden);
    }
    return { ok: true };
  }
}
