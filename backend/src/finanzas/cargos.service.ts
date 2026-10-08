import { CicloEscolar } from '../entities/ciclo-escolar.entity';
import { BadRequestException, ForbiddenException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { BitacoraFinanciera } from '../entities/bitacora-financiera.entity';
import { OrdenPago } from '../entities/orden-pago.entity';
import { Cargo } from '../entities/cargo.entity';
import { Pago } from '../entities/pago.entity';
import { Inscripcion } from '../entities/inscripcion.entity';
import { Grupo } from '../entities/grupo.entity';
import { Alumno } from '../entities/alumno.entity';
import { ConceptoPago } from '../entities/concepto-pago.entity';
import { AlumnosService } from '../alumnos/alumnos.service';
import { ScopeService } from '../planteles/scope.service';
import { ConceptosService } from './conceptos.service';
import { BitacoraFinancieraService } from './bitacora-financiera.service';
import { JwtUser } from '../common/current-user.decorator';
import { AplicarRecargosDto, CrearCargoDto, GenerarColegiaturasDto, ListarCargosDto } from './finanzas.dto';

const redondear = (n: number) => Math.round(n * 100) / 100;

function esConflictoUnico(error: unknown): boolean {
  const e = error as { code?: string; errno?: number; number?: number; originalError?: { info?: { number?: number } } };
  return e?.code === 'ER_DUP_ENTRY' || e?.errno === 1062 || e?.number === 2601 || e?.number === 2627 ||
    e?.originalError?.info?.number === 2601 || e?.originalError?.info?.number === 2627;
}

export interface CargoConSaldo extends Cargo {
  total: number;
  pagado: number;
  saldo: number;
}

/**
 * Única responsabilidad: el ciclo de vida de las cuentas por cobrar —
 * cargos, colegiaturas masivas, recargos, saldos, adeudos y estado de cuenta.
 */
@Injectable()
export class CargosService {
  constructor(
    @InjectRepository(Cargo) private readonly cargos: Repository<Cargo>,
    @InjectRepository(Pago) private readonly pagos: Repository<Pago>,
    @InjectRepository(Inscripcion) private readonly inscripciones: Repository<Inscripcion>,
    @InjectRepository(Grupo) private readonly grupos: Repository<Grupo>,
    private readonly alumnos: AlumnosService,
    private readonly conceptos: ConceptosService,
    private readonly bitacora: BitacoraFinancieraService,
    private readonly scope: ScopeService,
    private readonly dataSource: DataSource,
  ) {}

  totalDeCargo(cargo: Cargo): number {
    return redondear(cargo.monto - cargo.descuento + cargo.recargo);
  }

  /** Suma de pagos confirmados por cargo, en UNA consulta agrupada (evita N+1). */
  async pagadoPorCargo(cargoIds: number[], manager?: EntityManager): Promise<Map<number, number>> {
    if (cargoIds.length === 0) return new Map();
    const pagos = manager?.getRepository(Pago) ?? this.pagos;
    const filas = await pagos
      .createQueryBuilder('p')
      .select('p.cargo_id', 'cargoId')
      .addSelect('SUM(p.monto)', 'pagado')
      .where('p.estatus = :e', { e: 'CONFIRMADO' })
      .andWhere('p.cargo_id IN (:...ids)', { ids: cargoIds })
      .groupBy('p.cargo_id')
      .getRawMany<{ cargoId: number; pagado: string }>();
    return new Map(filas.map((f) => [Number(f.cargoId), redondear(Number(f.pagado))]));
  }

  async listar(query: ListarCargosDto, user: JwtUser) {
    const pagina = query.pagina || 1;
    const porPagina = query.porPagina || 20;
    const planteles = await this.scope.resolverFiltro(user, query.plantelId);
    const qb = this.cargos.createQueryBuilder('c')
      .innerJoinAndSelect('c.alumno', 'a')
      .leftJoinAndSelect('a.usuario', 'u');
    if (planteles !== null) qb.andWhere('c.plantel_id IN (:...planteles)', { planteles });
    if (query.alumnoId) qb.andWhere('c.alumno_id = :alumnoId', { alumnoId: query.alumnoId });
    if (query.estatus) qb.andWhere('c.estatus = :estatus', { estatus: query.estatus });
    if (query.buscar?.trim()) qb.andWhere('(c.descripcion LIKE :buscar OR a.matricula LIKE :buscar)', { buscar: `%${query.buscar.trim()}%` });
    if (query.periodo) qb.andWhere('c.periodo = :periodo', { periodo: query.periodo });
    const [datos, total] = await qb
      .orderBy('c.id', 'DESC')
      .skip((pagina - 1) * porPagina)
      .take(porPagina)
      .getManyAndCount();
    return {
      datos: datos.map((cargo) => this.proyectarCargoFinanciero(cargo)),
      total, pagina, porPagina,
    };
  }

  async listarAlumnosFinancieros(query: ListarCargosDto, user: JwtUser) {
    const planteles = await this.scope.resolverFiltro(user);
    const qb = this.dataSource.getRepository(Alumno).createQueryBuilder('a').innerJoin('a.usuario', 'u')
      .select(['a.id', 'a.matricula', 'u.id', 'u.nombre', 'u.apellidoPaterno']);
    if (planteles !== null) qb.where('(a.plantel_id IN (:...planteles) OR EXISTS (SELECT 1 FROM cargos c WHERE c.alumno_id = a.id AND c.plantel_id IN (:...planteles)) OR EXISTS (SELECT 1 FROM pagos p WHERE p.alumno_id = a.id AND p.plantel_id IN (:...planteles)))', { planteles });
    if (query.buscar?.trim()) qb.andWhere('(a.matricula LIKE :buscar OR u.nombre LIKE :buscar OR u.apellido_paterno LIKE :buscar)', { buscar: `%${query.buscar.trim()}%` });
    const pagina = query.pagina || 1, porPagina = query.porPagina || 20;
    const [datos, total] = await qb.orderBy('a.matricula', 'ASC').skip((pagina - 1) * porPagina).take(porPagina).getManyAndCount();
    return { datos: datos.map((a) => ({ id: a.id, matricula: a.matricula, usuario: { nombre: a.usuario.nombre, apellidoPaterno: a.usuario.apellidoPaterno } })), total, pagina, porPagina };
  }

  async obtener(id: number) {
    const cargo = await this.cargos.findOne({ where: { id } });
    if (!cargo) throw new NotFoundException('Cargo no encontrado');
    return cargo;
  }

  async validarAcceso(cargo: Pick<Cargo, 'plantelId' | 'alumno'>, user: JwtUser) {
    if (user.roles.includes('ALUMNO')) {
      if (cargo.alumno.usuarioId !== user.sub) throw new ForbiddenException('Solo puedes consultar tus propios cargos');
    } else await this.scope.validarGestion(user, cargo.plantelId);
  }

  async crear(dto: CrearCargoDto, user: JwtUser) {
    if (dto.monto <= 0 || (dto.descuento ?? 0) > dto.monto) {
      throw new BadRequestException('El monto debe ser positivo y el descuento no puede excederlo');
    }
    const concepto = await this.conceptos.obtener(dto.conceptoId);
    if (!concepto.activo || ['BECA', 'DESCUENTO', 'RECARGO'].includes(concepto.tipo)) throw new BadRequestException('Selecciona un concepto de cobro activo; la beca o descuento se aplica como descuento del cargo');
    const alumno = await this.alumnos.obtener(dto.alumnoId, user);
    return this.dataSource.transaction(async (manager) => {
      const cargos = manager.getRepository(Cargo);
      const cargo = await cargos.save(
        cargos.create({
          alumnoId: dto.alumnoId, plantelId: alumno.plantelId,
          conceptoId: dto.conceptoId,
          cicloId: dto.cicloId ?? null,
          periodo: dto.periodo ?? null,
          descripcion: dto.descripcion,
          monto: dto.monto,
          descuento: dto.descuento ?? 0,
          fechaVencimiento: dto.fechaVencimiento ?? null,
        }),
      );
      await this.bitacora.registrar(
        user.sub, 'CREAR_CARGO', 'cargo', cargo.id, `${dto.descripcion} $${dto.monto}`, alumno.plantelId, manager,
      );
      return cargo;
    });
  }

  async cancelar(id: number, motivo: string, user: JwtUser) {
    if (!motivo.trim()) throw new BadRequestException('Indica el motivo de cancelación');
    return this.dataSource.transaction(async (manager) => {
      const cargos = manager.getRepository(Cargo);
      const cargo = await cargos.findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!cargo) throw new NotFoundException('Cargo no encontrado');
      await this.scope.validarGestion(user, cargo.plantelId);
      if (cargo.estatus === 'CANCELADO') throw new ConflictException('El cargo ya está cancelado');
      const pagos = await manager.getRepository(Pago).count({ where: { cargoId: id, estatus: 'CONFIRMADO' } });
      const ordenes = await manager.getRepository(OrdenPago).count({ where: { cargoId: id, estatus: In(['CREADA', 'PENDIENTE']) } });
      if (pagos || ordenes) throw new ConflictException('No puedes cancelar un cargo con pagos aplicados u órdenes pendientes');
      cargo.estatus = 'CANCELADO'; await cargos.save(cargo);
      await manager.getRepository(BitacoraFinanciera).insert({ usuarioId: user.sub, plantelId: cargo.plantelId,
        accion: 'CANCELAR_CARGO', entidad: 'cargo', entidadId: id, detalle: motivo.trim() });
      return { ok: true };
    });
  }

  /**
   * Colegiatura del periodo para todos los inscritos activos del ciclo.
   * Idempotente; cada cargo y su bitácora se confirman en la misma transacción.
   */
  async generarColegiaturas(dto: GenerarColegiaturasDto, user: JwtUser, preview = false) {
    if (!dto.plantelId) throw new BadRequestException('Selecciona un plantel para esta operación');
    if (!preview && !dto.confirmado) throw new BadRequestException('Revisa la previsualización y confirma la operación');
    const ciclo = await this.dataSource.getRepository(CicloEscolar).findOneBy({ id: dto.cicloId, activo: true });
    if (!ciclo) throw new ConflictException('Las colegiaturas masivas requieren el ciclo vigente');
    const concepto = await this.conceptos.porClave('COL');
    if (!concepto.activo || concepto.tipo !== 'COLEGIATURA') throw new BadRequestException('COL debe ser una colegiatura activa');
    const monto = dto.monto ?? concepto.montoBase;
    if (monto <= 0) throw new BadRequestException('Monto de colegiatura inválido');

    const planteles = await this.scope.resolverFiltro(user, dto.plantelId);
    const gruposDelCiclo = await this.grupos.find({
      where: {
        cicloId: dto.cicloId, ciclo: { activo: true }, plantel: { activo: true },
        activo: true,
        ...(planteles === null ? {} : { plantelId: this.scope.condicion(planteles) }),
      },
    });
    if (gruposDelCiclo.length === 0) return { generados: 0, omitidos: 0 };

    const inscripciones = (await this.inscripciones.find({
      where: { grupoId: In(gruposDelCiclo.map((g) => g.id)), estatus: 'ACTIVA', alumno: { estatus: 'ACTIVO', usuario: { activo: true } } },
    })).filter((inscripcion) => inscripcion.alumno.estatus === 'ACTIVO' && inscripcion.alumno.usuario.activo);
    const alumnoIds = [...new Set(inscripciones.map((i) => i.alumnoId))];
    if (alumnoIds.length === 0) return { generados: 0, omitidos: 0 };

    const existentes = await this.cargos.find({
      select: { alumnoId: true },
      where: { conceptoId: concepto.id, cicloId: dto.cicloId, periodo: dto.periodo, alumnoId: In(alumnoIds) },
    });
    const yaGenerados = new Set(existentes.map((c) => c.alumnoId));

    const dia = String(dto.diaVencimiento ?? 5).padStart(2, '0');
    const vencimiento = `${dto.periodo}-${dia}`;
    const nuevos = alumnoIds
      .filter((alumnoId) => !yaGenerados.has(alumnoId))
      .map((alumnoId) =>
        this.cargos.create({
          alumnoId,
          conceptoId: concepto.id,
          cicloId: dto.cicloId,
          periodo: dto.periodo,
          claveGeneracion: `COLEGIATURA:${dto.cicloId}:${alumnoId}:${dto.periodo}`,
          descripcion: `Colegiatura ${dto.periodo}`,
          monto,
          fechaVencimiento: vencimiento,
        }),
      );
    if (preview) return { plantelId: dto.plantelId, cicloId: dto.cicloId, periodo: dto.periodo,
      registros: nuevos.length, monto, totalEstimado: redondear(nuevos.length * monto), omitidos: yaGenerados.size, vencimiento };
    let generados = 0;
    let omitidosConcurrentes = 0;
    for (const nuevo of nuevos) {
      try {
        const guardado = await this.dataSource.transaction(async (manager) => {
          // Ciclo y alumno se bloquean también en cierre, baja y transferencia.
          const vigente = await manager.getRepository(CicloEscolar).findOne({ where: { id: dto.cicloId }, lock: { mode: 'pessimistic_write' } });
          if (!vigente?.activo) return false;
          const alumno = await manager.getRepository(Alumno).findOne({ where: { id: nuevo.alumnoId }, lock: { mode: 'pessimistic_write' } });
          if (!alumno || alumno.estatus !== 'ACTIVO' || !alumno.usuario.activo || (planteles !== null && !planteles.includes(alumno.plantelId))) return false;
          if (!await manager.getRepository(ConceptoPago).existsBy({ id: concepto.id, activo: true, tipo: 'COLEGIATURA' })) return false;
          if (!await manager.getRepository(Inscripcion).existsBy({ alumnoId: alumno.id, estatus: 'ACTIVA', grupo: { cicloId: dto.cicloId, plantelId: alumno.plantelId, activo: true, plantel: { activo: true } } })) return false;
          nuevo.plantelId = alumno.plantelId;
          const cargo = await manager.getRepository(Cargo).save(nuevo);
          const plantelId = alumno.plantelId;
          await this.bitacora.registrar(
            user.sub, 'GENERAR_COLEGIATURA', 'cargo', cargo.id,
            `periodo=${dto.periodo} monto=${monto}`, plantelId, manager,
          );
          return true;
        });
        if (guardado) generados++; else omitidosConcurrentes++;
      } catch (error) {
        if (!esConflictoUnico(error)) throw error;
        omitidosConcurrentes++;
      }
    }
    return { generados, omitidos: yaGenerados.size + omitidosConcurrentes, vencimiento };
  }

  /** Aplica recargo a cargos vencidos sin liquidar (una sola vez por cargo). */
  async aplicarRecargos(dto: AplicarRecargosDto, user: JwtUser, preview = false) {
    if (!dto.plantelId) throw new BadRequestException('Selecciona un plantel para esta operación');
    if (!preview && !dto.confirmado) throw new BadRequestException('Revisa la previsualización y confirma la operación');
    const porcentaje = dto.porcentaje ?? 10;
    const hoy = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Mexico_City', year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(new Date());
    const planteles = await this.scope.resolverFiltro(user, dto.plantelId);
    const qb = this.cargos
      .createQueryBuilder('c')
      .innerJoin('c.alumno', 'a')
      .innerJoin('c.concepto', 'cp', 'cp.aplica_recargo = :aplicaRecargo AND cp.activo = :aplicaRecargo', { aplicaRecargo: true })
      .where('c.estatus IN (:...estatus)', { estatus: ['PENDIENTE', 'PARCIAL'] })
      .andWhere('c.fecha_vencimiento < :hoy', { hoy });
    if (planteles !== null) qb.andWhere('c.plantel_id IN (:...planteles)', { planteles });
    const candidatos = (await qb.getMany()).filter((c) => c.recargo === 0);
    if (preview) return { plantelId: dto.plantelId, porcentaje, registros: candidatos.length,
      totalEstimado: redondear(candidatos.reduce((s, c) => s + redondear((c.monto - c.descuento) * porcentaje / 100), 0)) };
    if (candidatos.length === 0) return { aplicados: 0, porcentaje };
    return this.dataSource.transaction(async (manager) => {
      const cargos = manager.getRepository(Cargo);
      const porPlantel = new Map<number, number>();
      let aplicados = 0;
      for (const candidato of candidatos.sort((a, b) => a.id - b.id)) {
        const cargo = await cargos.findOne({
          where: { id: candidato.id }, lock: { mode: 'pessimistic_write' },
        });
        if (!cargo || !cargo.concepto.aplicaRecargo || !cargo.concepto.activo || !['PENDIENTE', 'PARCIAL'].includes(cargo.estatus) ||
            !cargo.fechaVencimiento || cargo.fechaVencimiento >= hoy || cargo.recargo > 0 ||
            (planteles !== null && !planteles.includes(cargo.plantelId))) continue;
        cargo.recargo = redondear((cargo.monto - cargo.descuento) * (porcentaje / 100));
        cargo.estatus = 'VENCIDO';
        await cargos.save(cargo);
        aplicados++;
        const plantelId = cargo.plantelId;
        porPlantel.set(plantelId, (porPlantel.get(plantelId) ?? 0) + 1);
      }
      for (const [plantelId, cantidad] of porPlantel) {
        await this.bitacora.registrar(
          user.sub, 'APLICAR_RECARGOS', 'cargo', null, `${porcentaje}% a ${cantidad} cargos`, plantelId, manager,
        );
      }
      return { aplicados, porcentaje };
    });
  }

  /** Recalcula el estatus de un cargo con base en sus pagos confirmados. */
  async recalcularEstatus(cargoId: number, manager?: EntityManager) {
    const cargos = manager?.getRepository(Cargo) ?? this.cargos;
    const cargo = await cargos.findOne({ where: { id: cargoId } });
    if (!cargo || cargo.estatus === 'CANCELADO') return;
    const pagado = (await this.pagadoPorCargo([cargoId], manager)).get(cargoId) ?? 0;
    const total = this.totalDeCargo(cargo);
    cargo.estatus = pagado >= total ? 'PAGADO' : pagado > 0 ? 'PARCIAL' : cargo.recargo > 0 ? 'VENCIDO' : 'PENDIENTE';
    await cargos.save(cargo);
  }

  /** Saldo vivo de un cargo (para órdenes de pago). */
  async saldoDeCargo(cargo: Cargo, manager?: EntityManager): Promise<number> {
    const pagado = (await this.pagadoPorCargo([cargo.id], manager)).get(cargo.id) ?? 0;
    return redondear(this.totalDeCargo(cargo) - pagado);
  }

  async adeudosPaginados(user: JwtUser, query: ListarCargosDto) {
    const planteles = await this.scope.resolverFiltro(user, query.plantelId);
    const pagina = query.pagina || 1; const porPagina = query.porPagina || 20;
    const qb = this.cargos.createQueryBuilder('c').leftJoinAndSelect('c.alumno', 'a').leftJoinAndSelect('a.usuario', 'u')
      .where('c.estatus IN (:...estatus)', { estatus: ['PENDIENTE', 'PARCIAL', 'VENCIDO'] });
    if (planteles !== null) qb.andWhere('c.plantel_id IN (:...planteles)', { planteles });
    const [cargos, total] = await qb.orderBy('c.fechaVencimiento', 'ASC').addOrderBy('c.id', 'ASC')
      .skip((pagina - 1) * porPagina).take(porPagina).getManyAndCount();
    const pagado = await this.pagadoPorCargo(cargos.map((c) => c.id));
    return { datos: cargos.map((c) => this.proyectarCargoFinanciero({ ...c, total: this.totalDeCargo(c),
      pagado: pagado.get(c.id) ?? 0, saldo: redondear(this.totalDeCargo(c) - (pagado.get(c.id) ?? 0)) })), total, pagina, porPagina };
  }

  /** Cargos con saldo pendiente en todo el plantel (sin N+1). */
  async adeudos(user?: JwtUser, plantelId?: number, incluirContacto = false): Promise<CargoConSaldo[]> {
    const planteles = user ? await this.scope.resolverFiltro(user, plantelId) : null;
    const qb = this.cargos
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.alumno', 'a')
      .leftJoinAndSelect('a.usuario', 'u')
      .where('c.estatus IN (:...estatus)', { estatus: ['PENDIENTE', 'PARCIAL', 'VENCIDO'] })
      .orderBy('c.fecha_vencimiento', 'ASC');
    if (planteles !== null) qb.andWhere('c.plantel_id IN (:...planteles)', { planteles });
    const cargos = await qb.getMany();
    const pagado = await this.pagadoPorCargo(cargos.map((c) => c.id));
    return cargos
      .map((cargo) => {
        const total = this.totalDeCargo(cargo);
        const abonado = pagado.get(cargo.id) ?? 0;
        return this.proyectarCargoFinanciero({ ...cargo, total, pagado: abonado, saldo: redondear(total - abonado) }, incluirContacto) as CargoConSaldo;
      })
      .filter((c) => c.saldo > 0);
  }

  /** Estado de cuenta de un alumno: cargos con saldos + historial de pagos. */
  async estadoDeCuenta(alumnoId: number, user?: JwtUser) {
    const alumno = await this.alumnos.obtener(alumnoId);
    const planteles = user ? await this.scope.resolverFiltro(user) : null;
    const alcance = planteles === null ? {} : { plantelId: In(planteles) };
    const [cargos, pagos] = await Promise.all([
      this.cargos.find({
        where: { alumnoId, ...alcance, estatus: In(['PENDIENTE', 'PARCIAL', 'PAGADO', 'VENCIDO']) },
        order: { fechaVencimiento: 'ASC' },
      }),
      this.pagos.find({ where: { alumnoId, ...alcance }, order: { fechaPago: 'DESC' } }),
    ]);

    if (user && planteles !== null && !planteles.includes(alumno.plantelId) && !cargos.length && !pagos.length) throw new ForbiddenException('No hay operaciones del alumno dentro de tu alcance');
    const detalle = cargos.map((cargo) => {
      const pagado = pagos
        .filter((p) => p.cargoId === cargo.id && p.estatus === 'CONFIRMADO')
        .reduce((sum, p) => sum + p.monto, 0);
      const total = this.totalDeCargo(cargo);
      return this.proyectarCargoFinanciero({
        ...cargo, total, pagado: redondear(pagado), saldo: redondear(total - pagado),
      });
    });
    const saldoTotal = redondear(detalle.reduce((sum, c) => sum + (c.saldo ?? 0), 0));
    return {
      alumno: this.proyectarAlumnoFinanciero(alumno),
      cargos: detalle,
      pagos: pagos.map((pago) => ({
        id: pago.id, monto: pago.monto, metodo: pago.metodo, referencia: pago.referencia,
        estatus: pago.estatus, fechaPago: pago.fechaPago, aplicado: pago.cargoId !== null,
      })),
      saldoTotal,
    };
  }

  async miEstadoDeCuenta(user: JwtUser) {
    const alumno = await this.alumnos.obtenerPorUsuario(user.sub);
    return this.estadoDeCuenta(alumno.id);
  }

  private proyectarAlumnoFinanciero(alumno: Cargo['alumno'], incluirContacto = false) {
    return {
      id: alumno.id,
      matricula: alumno.matricula,
      estatus: alumno.estatus,
      plantelId: alumno.plantelId,
      ...(incluirContacto ? { usuarioId: alumno.usuarioId } : {}),
      usuario: alumno.usuario ? {
        nombre: alumno.usuario.nombre,
        apellidoPaterno: alumno.usuario.apellidoPaterno,
        nombreCompleto: alumno.usuario.nombreCompleto,
        ...(incluirContacto ? { email: alumno.usuario.email } : {}),
      } : undefined,
    };
  }

  private proyectarCargoFinanciero(cargo: Cargo & { total?: number; pagado?: number; saldo?: number }, incluirContacto = false) {
    return {
      id: cargo.id,
      alumnoId: cargo.alumnoId,
      conceptoId: cargo.conceptoId,
      plantelId: cargo.plantelId,
      cicloId: cargo.cicloId,
      periodo: cargo.periodo,
      descripcion: cargo.descripcion,
      monto: cargo.monto,
      descuento: cargo.descuento,
      recargo: cargo.recargo,
      fechaVencimiento: cargo.fechaVencimiento,
      estatus: cargo.estatus,
      alumno: this.proyectarAlumnoFinanciero(cargo.alumno, incluirContacto),
      ...('total' in cargo ? { total: cargo.total, pagado: cargo.pagado, saldo: cargo.saldo } : {}),
    };
  }
}
