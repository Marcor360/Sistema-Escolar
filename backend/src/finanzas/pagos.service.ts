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
    if (planteles !== null) qb.andWhere('p.plantel_id IN (:...planteles)', { planteles });
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
    if (!dto.cargoId) throw new BadRequestException('Selecciona el cargo al que aplicar el pago; el piloto no admite anticipos sin cargo');
    const origen = await this.cargos.obtener(dto.cargoId);
    await this.scope.validarGestion(user, origen.plantelId);
    const existente = await this.pagos.findOne({ where: { claveIdempotencia: dto.claveIdempotencia } });
    if (existente) return this.verificarReintento(existente, dto, user);
    try {
      return await this.dataSource.transaction(async (manager) => {
        {
          const cargo = await manager.getRepository(Cargo).findOne({
            where: { id: dto.cargoId }, lock: { mode: 'pessimistic_write' },
          });
          if (!cargo) throw new NotFoundException('Cargo no encontrado');
          await this.scope.validarGestion(user, cargo.plantelId);
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
            alumnoId: dto.alumnoId, plantelId: origen.plantelId,
            cargoId: dto.cargoId,
            monto: dto.monto,
            metodo: dto.metodo,
            referencia: dto.referencia ?? null,
            claveIdempotencia: dto.claveIdempotencia,
            estatus: 'CONFIRMADO',
            fechaPago: new Date(),
            registradoPorId: user.sub,
          }),
        );
        await this.cargos.recalcularEstatus(dto.cargoId, manager);
        await manager.getRepository(BitacoraFinanciera).insert({
          usuarioId: user.sub,
          plantelId: origen.plantelId,
          accion: 'PAGO_MANUAL',
          entidad: 'pago',
          entidadId: pago.id,
          detalle: `$${dto.monto} ${dto.metodo} cargo=${dto.cargoId}`,
        });
        return pago;
      });
    } catch (error) {
      const duplicado = await this.pagos.findOne({ where: { claveIdempotencia: dto.claveIdempotencia } });
      if (!duplicado) throw error;
      return this.verificarReintento(duplicado, dto, user);
    }
  }

  async noAplicados(user: JwtUser, pagina = 1) {
    const planteles = await this.scope.resolverFiltro(user);
    const qb = this.pagos.createQueryBuilder('p').innerJoinAndSelect('p.alumno', 'a').leftJoinAndSelect('a.usuario', 'u')
      .where('p.cargo_id IS NULL AND p.estatus = :estatus', { estatus: 'CONFIRMADO' });
    if (planteles !== null) qb.andWhere('p.plantel_id IN (:...planteles)', { planteles });
    const [datos, total] = await qb.orderBy('p.fechaPago', 'DESC').addOrderBy('p.id', 'DESC').skip((pagina - 1) * 20).take(20).getManyAndCount();
    return { datos: datos.map((p) => ({ id: p.id, monto: p.monto, referencia: p.referencia, metodo: p.metodo, fecha: p.fechaPago,
      alumnoId: p.alumnoId, matricula: p.alumno.matricula, motivo: 'Pago confirmado sin aplicación a cargo', estatus: p.estatus })), total, pagina, porPagina: 20 };
  }

  async aplicarNoAplicado(id: number, cargoId: number, motivo: string, user: JwtUser) {
    if (!motivo.trim()) throw new BadRequestException('Indica el motivo de conciliación');
    return this.dataSource.transaction(async (manager) => {
      const cargo = await manager.getRepository(Cargo).findOne({ where: { id: cargoId }, lock: { mode: 'pessimistic_write' } });
      if (!cargo) throw new NotFoundException('Cargo no encontrado');
      await this.scope.validarGestion(user, cargo.plantelId);
      const pagos = manager.getRepository(Pago);
      const pago = await pagos.findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!pago) throw new NotFoundException('Pago no encontrado');
      await this.scope.validarGestion(user, pago.plantelId);
      if (pago.plantelId !== cargo.plantelId) throw new ConflictException('El pago y cargo deben pertenecer al mismo plantel de origen');
      if (pago.cargoId !== null || pago.estatus !== 'CONFIRMADO') throw new ConflictException('El pago no está pendiente de aplicación');
      if (pago.alumnoId !== cargo.alumnoId || cargo.estatus === 'CANCELADO') throw new BadRequestException('Selecciona un cargo válido del mismo alumno');
      const ordenPendiente = await manager.getRepository(OrdenPago).findOne({ where: { cargoId, estatus: In(['CREADA', 'PENDIENTE']) } });
      if (ordenPendiente) throw new ConflictException('El cargo está reservado por una orden pendiente');
      if (Math.round(Number(pago.monto) * 100) > Math.round((await this.cargos.saldoDeCargo(cargo, manager)) * 100)) throw new ConflictException('El importe excede el saldo del cargo');
      pago.cargoId = cargoId; await pagos.save(pago); await this.cargos.recalcularEstatus(cargoId, manager);
      await manager.getRepository(BitacoraFinanciera).insert({ usuarioId: user.sub, plantelId: cargo.plantelId,
        accion: 'CONCILIAR_PAGO', entidad: 'pago', entidadId: id, detalle: `cargo=${cargoId}; ${motivo.trim()}` });
      return { ok: true };
    });
  }

  async anular(id: number, motivo: string, user: JwtUser) {
    if (!motivo.trim()) throw new BadRequestException('Indica el motivo de anulación');
    const previo = await this.pagos.findOne({ where: { id } });
    if (!previo) throw new NotFoundException('Pago no encontrado');
    await this.scope.validarGestion(user, previo.plantelId);
    return this.dataSource.transaction(async (manager) => {
      if (previo.cargoId) await manager.getRepository(Cargo).findOne({ where: { id: previo.cargoId }, lock: { mode: 'pessimistic_write' } });
      const pagos = manager.getRepository(Pago);
      const pago = await pagos.findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!pago || pago.estatus !== 'CONFIRMADO') throw new ConflictException('El pago ya no admite anulación');
      if (pago.metodo === 'PASARELA') throw new ConflictException('Los pagos de pasarela requieren conciliación o devolución en el proveedor');
      if (pago.cargoId !== previo.cargoId) throw new ConflictException('El pago cambió; vuelve a consultar');
      await this.scope.validarGestion(user, pago.plantelId);
      pago.estatus = 'CANCELADO'; await pagos.save(pago);
      if (pago.cargoId) await this.cargos.recalcularEstatus(pago.cargoId, manager);
      await manager.getRepository(BitacoraFinanciera).insert({ usuarioId: user.sub, plantelId: pago.plantelId,
        accion: 'ANULAR_PAGO', entidad: 'pago', entidadId: id, detalle: motivo.trim() });
      return { ok: true };
    });
  }

  private verificarReintento(pago: Pago, dto: RegistrarPagoDto, user: JwtUser): Pago {
    const mismoPago = pago.registradoPorId === user.sub && pago.alumnoId === dto.alumnoId &&
      pago.cargoId === (dto.cargoId ?? null) && pago.metodo === dto.metodo &&
      pago.referencia === (dto.referencia ?? null) && pago.estatus === 'CONFIRMADO' &&
      Math.round(Number(pago.monto) * 100) === Math.round(dto.monto * 100);
    if (!mismoPago) throw new ConflictException('La clave de idempotencia ya se usó para otro pago');
    return pago;
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
      const aplicado = !!cargo && cargo.estatus !== 'CANCELADO' && Math.round(monto * 100) <= Math.round(saldo * 100);
      const nuevo = await pagos.save(pagos.create({
        alumnoId: ordenActual.alumnoId, plantelId: ordenActual.plantelId,
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
        plantelId: ordenActual.plantelId,
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
