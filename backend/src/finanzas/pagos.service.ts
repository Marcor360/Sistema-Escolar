import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { Pago } from '../entities/pago.entity';
import { OrdenPago } from '../entities/orden-pago.entity';
import { Cargo } from '../entities/cargo.entity';
import { BitacoraFinanciera } from '../entities/bitacora-financiera.entity';
import { AlumnosService } from '../alumnos/alumnos.service';
import { CargosService } from './cargos.service';
import { JwtUser } from '../common/current-user.decorator';
import { ScopeService } from '../planteles/scope.service';
import { ListarPagosDto, RegistrarPagoDto } from './finanzas.dto';

/** Única responsabilidad: registrar pagos (ventanilla y pasarela) y consultarlos. */
@Injectable()
export class PagosService {
  constructor(
    @InjectRepository(Pago) private readonly pagos: Repository<Pago>,
    private readonly alumnos: AlumnosService,
    private readonly cargos: CargosService,
    private readonly scope: ScopeService,
    private readonly dataSource: DataSource,
  ) {}

  async listar(query: ListarPagosDto, user: JwtUser) {
    const pagina = query.pagina || 1;
    const porPagina = query.porPagina || 20;
    const planteles = await this.scope.resolverFiltro(user);
    const qb = this.pagos.createQueryBuilder('p')
      .innerJoinAndSelect('p.alumno', 'a')
      .leftJoinAndSelect('a.usuario', 'u');
    if (planteles !== null) qb.andWhere('a.plantel_id IN (:...planteles)', { planteles });
    if (query.alumnoId) qb.andWhere('p.alumno_id = :alumnoId', { alumnoId: query.alumnoId });
    const [datos, total] = await qb
      .orderBy('p.id', 'DESC')
      .skip((pagina - 1) * porPagina)
      .take(porPagina)
      .getManyAndCount();
    return {
      datos: datos.map((pago) => ({
        id: pago.id,
        monto: pago.monto,
        metodo: pago.metodo,
        referencia: pago.referencia,
        estatus: pago.estatus,
        fechaPago: pago.fechaPago,
        alumno: {
          id: pago.alumno.id,
          matricula: pago.alumno.matricula,
          usuario: {
            nombre: pago.alumno.usuario.nombre,
            apellidoPaterno: pago.alumno.usuario.apellidoPaterno,
          },
        },
      })),
      total, pagina, porPagina,
    };
  }

  /** Pago manual de ventanilla (efectivo/transferencia/tarjeta). */
  async registrarManual(dto: RegistrarPagoDto, user: JwtUser) {
    const alumno = await this.alumnos.obtener(dto.alumnoId, user);
    return this.dataSource.transaction(async (manager) => {
      if (dto.cargoId) {
        const cargo = await manager.getRepository(Cargo).findOne({
          where: { id: dto.cargoId }, lock: { mode: 'pessimistic_write' },
        });
        if (!cargo) throw new NotFoundException('Cargo no encontrado');
        if (cargo.alumnoId !== dto.alumnoId) {
          throw new BadRequestException('El cargo no pertenece al alumno indicado');
        }
        if (cargo.estatus === 'CANCELADO') throw new BadRequestException('No se puede pagar un cargo cancelado');

        const ordenPendiente = await manager.getRepository(OrdenPago).findOne({
          where: { cargoId: cargo.id, estatus: In(['CREADA', 'PENDIENTE']) },
        });
        if (ordenPendiente) {
          throw new ConflictException('El cargo tiene una orden Openpay pendiente; espera su resultado antes de registrar otro pago');
        }
        const saldo = await this.cargos.saldoDeCargo(cargo, manager);
        if (Math.round(dto.monto * 100) > Math.round(saldo * 100)) {
          throw new BadRequestException(`El pago excede el saldo pendiente de $${saldo.toFixed(2)}`);
        }
      }

      const pagos = manager.getRepository(Pago);
      const pago = await pagos.save(
        pagos.create({
          alumnoId: dto.alumnoId,
          cargoId: dto.cargoId ?? null,
          monto: dto.monto,
          metodo: dto.metodo,
          referencia: dto.referencia ?? null,
          estatus: 'CONFIRMADO',
          fechaPago: new Date(),
          registradoPorId: user.sub,
        }),
      );
      if (dto.cargoId) await this.cargos.recalcularEstatus(dto.cargoId, manager);
      await manager.getRepository(BitacoraFinanciera).insert({
        usuarioId: user.sub,
        plantelId: alumno.plantelId,
        accion: 'PAGO_MANUAL',
        entidad: 'pago',
        entidadId: pago.id,
        detalle: dto.cargoId
          ? `$${dto.monto} ${dto.metodo} cargo=${dto.cargoId}`
          : `$${dto.monto} ${dto.metodo} sin_cargo; pago_no_aplicado`,
      });
      return pago;
    });
  }

  /** Pago confirmado por la pasarela (lo invoca el procesamiento del webhook). */
  async registrarDePasarela(
    orden: OrdenPago, monto: number, referencia: string, payloadWebhook = orden.payloadWebhook ?? '',
  ) {
    return this.dataSource.transaction(async (manager) => {
      // Lock order is cargo first, then order, across manual and online payments.
      const cargo = orden.cargoId
        ? await manager.getRepository(Cargo).findOne({
          where: { id: orden.cargoId }, lock: { mode: 'pessimistic_write' },
        })
        : null;
      const ordenActual = await manager.getRepository(OrdenPago).findOne({
        where: { id: orden.id }, lock: { mode: 'pessimistic_write' },
      });
      if (!ordenActual) throw new NotFoundException('Orden no encontrada');
      if (ordenActual.cargoId !== orden.cargoId || ordenActual.alumnoId !== orden.alumnoId) {
        throw new ConflictException('La orden cambió y requiere conciliación');
      }

      const pagos = manager.getRepository(Pago);
      const existente = await pagos.findOne({ where: { ordenPagoId: ordenActual.id } });
      if (existente) {
        if (cargo && existente.cargoId === cargo.id) await this.cargos.recalcularEstatus(cargo.id, manager);
        ordenActual.estatus = 'COMPLETADA';
        ordenActual.idExterno = referencia;
        ordenActual.payloadWebhook = payloadWebhook;
        await manager.getRepository(OrdenPago).save(ordenActual);
        return { pago: existente, creado: false, aplicado: existente.cargoId !== null };
      }
      if (ordenActual.estatus === 'COMPLETADA') {
        throw new ConflictException('La orden ya no admite una confirmacion de pago');
      }
      if (ordenActual.cargoId && !cargo) throw new NotFoundException('Cargo de la orden no encontrado');
      if (Math.round(Number(ordenActual.monto) * 100) !== Math.round(monto * 100)) {
        throw new BadRequestException('El importe confirmado no coincide con la orden');
      }

      // If an external payment already consumed the balance, keep the captured
      // funds as an unapplied receipt linked to the order for financial review.
      const saldo = cargo ? await this.cargos.saldoDeCargo(cargo, manager) : 0;
      const aplicado = !!cargo && Math.round(monto * 100) <= Math.round(saldo * 100);
      const nuevo = await pagos.save(pagos.create({
        alumnoId: ordenActual.alumnoId,
        cargoId: aplicado ? ordenActual.cargoId : null,
        ordenPagoId: ordenActual.id,
        monto,
        metodo: 'PASARELA',
        referencia,
        estatus: 'CONFIRMADO',
        fechaPago: new Date(),
      }));
      ordenActual.estatus = 'COMPLETADA';
      ordenActual.idExterno = referencia;
      ordenActual.payloadWebhook = payloadWebhook;
      await manager.getRepository(OrdenPago).save(ordenActual);
      if (aplicado && cargo) await this.cargos.recalcularEstatus(cargo.id, manager);
      await manager.getRepository(BitacoraFinanciera).insert({
        usuarioId: null,
        plantelId: orden.alumno.plantelId,
        accion: aplicado ? 'PAGO_PASARELA' : 'PAGO_PASARELA_NO_APLICADO',
        entidad: 'pago',
        entidadId: nuevo.id,
        detalle: aplicado
          ? `openpay=${referencia} $${monto}`
          : `openpay=${referencia} $${monto}; orden=${ordenActual.id}; saldo_insuficiente_para_aplicar`,
      });
      return { pago: nuevo, creado: true, aplicado };
    });
  }

}
