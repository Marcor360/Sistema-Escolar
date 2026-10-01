import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, Repository } from 'typeorm';
import { Cargo } from '../entities/cargo.entity';
import { Pago } from '../entities/pago.entity';
import { Inscripcion } from '../entities/inscripcion.entity';
import { Grupo } from '../entities/grupo.entity';
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
    const planteles = await this.scope.resolverFiltro(user);
    const qb = this.cargos.createQueryBuilder('c')
      .innerJoinAndSelect('c.alumno', 'a')
      .leftJoinAndSelect('a.usuario', 'u');
    if (planteles !== null) qb.andWhere('a.plantel_id IN (:...planteles)', { planteles });
    if (query.alumnoId) qb.andWhere('c.alumno_id = :alumnoId', { alumnoId: query.alumnoId });
    if (query.estatus) qb.andWhere('c.estatus = :estatus', { estatus: query.estatus });
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

  async obtener(id: number) {
    const cargo = await this.cargos.findOne({ where: { id } });
    if (!cargo) throw new NotFoundException('Cargo no encontrado');
    return cargo;
  }

  async crear(dto: CrearCargoDto, user: JwtUser) {
    await this.conceptos.obtener(dto.conceptoId);
    const alumno = await this.alumnos.obtener(dto.alumnoId, user);
    const cargo = await this.cargos.save(
      this.cargos.create({
        alumnoId: dto.alumnoId,
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
      user.sub, 'CREAR_CARGO', 'cargo', cargo.id, `${dto.descripcion} $${dto.monto}`, alumno.plantelId,
    );
    return cargo;
  }

  /**
   * Colegiatura del periodo para todos los inscritos activos del ciclo.
   * Idempotente y en lote: 3 consultas de lectura + 1 inserción masiva.
   */
  async generarColegiaturas(dto: GenerarColegiaturasDto, user: JwtUser) {
    const concepto = await this.conceptos.porClave('COL');
    const monto = dto.monto ?? concepto.montoBase;
    if (monto <= 0) throw new BadRequestException('Monto de colegiatura inválido');

    const planteles = await this.scope.resolverFiltro(user, dto.plantelId);
    const gruposDelCiclo = await this.grupos.find({
      where: {
        cicloId: dto.cicloId,
        ...(planteles === null ? {} : { plantelId: this.scope.condicion(planteles) }),
      },
    });
    if (gruposDelCiclo.length === 0) return { generados: 0, omitidos: 0 };

    const inscripciones = await this.inscripciones.find({
      where: { grupoId: In(gruposDelCiclo.map((g) => g.id)), estatus: 'ACTIVA' },
    });
    const alumnoIds = [...new Set(inscripciones.map((i) => i.alumnoId))];
    if (alumnoIds.length === 0) return { generados: 0, omitidos: 0 };

    const existentes = await this.cargos.find({
      select: { alumnoId: true },
      where: { conceptoId: concepto.id, cicloId: dto.cicloId, periodo: dto.periodo, alumnoId: In(alumnoIds) },
    });
    const yaGenerados = new Set(existentes.map((c) => c.alumnoId));
    const plantelPorAlumno = new Map(inscripciones.map((i) => [i.alumnoId, i.alumno.plantelId]));
    const resumenPlantel = new Map<number, { generados: number; omitidos: number }>();
    for (const alumnoId of alumnoIds) {
      const plantelId = plantelPorAlumno.get(alumnoId);
      if (plantelId === undefined) continue;
      const resumen = resumenPlantel.get(plantelId) ?? { generados: 0, omitidos: 0 };
      if (yaGenerados.has(alumnoId)) resumen.omitidos++;
      resumenPlantel.set(plantelId, resumen);
    }

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
    let generados = 0;
    let omitidosConcurrentes = 0;
    for (const nuevo of nuevos) {
      try {
        await this.cargos.save(nuevo);
        generados++;
        const plantelId = plantelPorAlumno.get(nuevo.alumnoId);
        if (plantelId !== undefined) resumenPlantel.get(plantelId)!.generados++;
      } catch (error) {
        if (!esConflictoUnico(error)) throw error;
        omitidosConcurrentes++;
        const plantelId = plantelPorAlumno.get(nuevo.alumnoId);
        if (plantelId !== undefined) resumenPlantel.get(plantelId)!.omitidos++;
      }
    }

    await Promise.all([...resumenPlantel].map(([plantelId, resumen]) => this.bitacora.registrar(
      user.sub, 'GENERAR_COLEGIATURAS', 'cargo', null,
      `periodo=${dto.periodo} generados=${resumen.generados} omitidos=${resumen.omitidos}`,
      plantelId,
    )));
    return { generados, omitidos: yaGenerados.size + omitidosConcurrentes, vencimiento };
  }

  /** Aplica recargo a cargos vencidos sin liquidar (una sola vez por cargo). */
  async aplicarRecargos(dto: AplicarRecargosDto, user: JwtUser) {
    const porcentaje = dto.porcentaje ?? 10;
    const hoy = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Mexico_City', year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(new Date());
    const planteles = await this.scope.resolverFiltro(user, dto.plantelId);
    const qb = this.cargos
      .createQueryBuilder('c')
      .innerJoin('c.alumno', 'a')
      .where('c.estatus IN (:...estatus)', { estatus: ['PENDIENTE', 'PARCIAL'] })
      .andWhere('c.fecha_vencimiento < :hoy', { hoy });
    if (planteles !== null) qb.andWhere('a.plantel_id IN (:...planteles)', { planteles });
    const vencidos = await qb.getMany();

    const modificados: Cargo[] = [];
    for (const cargo of vencidos) {
      if (cargo.recargo > 0) continue;
      cargo.recargo = redondear((cargo.monto - cargo.descuento) * (porcentaje / 100));
      cargo.estatus = 'VENCIDO';
      modificados.push(cargo);
    }
    if (modificados.length > 0) await this.cargos.save(modificados);
    const porPlantel = new Map<number, number>();
    for (const cargo of modificados) {
      const plantelId = cargo.alumno.plantelId;
      porPlantel.set(plantelId, (porPlantel.get(plantelId) ?? 0) + 1);
    }
    await Promise.all([...porPlantel].map(([plantelId, cantidad]) => this.bitacora.registrar(
      user.sub, 'APLICAR_RECARGOS', 'cargo', null, `${porcentaje}% a ${cantidad} cargos`, plantelId,
    )));
    return { aplicados: modificados.length, porcentaje };
  }

  /** Recalcula el estatus de un cargo con base en sus pagos confirmados. */
  async recalcularEstatus(cargoId: number, manager?: EntityManager) {
    const cargos = manager?.getRepository(Cargo) ?? this.cargos;
    const cargo = await cargos.findOne({ where: { id: cargoId } });
    if (!cargo || cargo.estatus === 'CANCELADO') return;
    const pagado = (await this.pagadoPorCargo([cargoId], manager)).get(cargoId) ?? 0;
    const total = this.totalDeCargo(cargo);
    cargo.estatus = pagado >= total ? 'PAGADO' : pagado > 0 ? 'PARCIAL' : cargo.estatus;
    await cargos.save(cargo);
  }

  /** Saldo vivo de un cargo (para órdenes de pago). */
  async saldoDeCargo(cargo: Cargo): Promise<number> {
    const pagado = (await this.pagadoPorCargo([cargo.id])).get(cargo.id) ?? 0;
    return redondear(this.totalDeCargo(cargo) - pagado);
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
    if (planteles !== null) qb.andWhere('a.plantel_id IN (:...planteles)', { planteles });
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
    const alumno = await this.alumnos.obtener(alumnoId, user);
    const [cargos, pagos] = await Promise.all([
      this.cargos.find({
        where: { alumnoId, estatus: In(['PENDIENTE', 'PARCIAL', 'PAGADO', 'VENCIDO']) },
        order: { fechaVencimiento: 'ASC' },
      }),
      this.pagos.find({ where: { alumnoId }, order: { fechaPago: 'DESC' } }),
    ]);

    const detalle = cargos.map((cargo) => {
      const pagado = pagos
        .filter((p) => p.cargoId === cargo.id && p.estatus === 'CONFIRMADO')
        .reduce((sum, p) => sum + p.monto, 0);
      const total = this.totalDeCargo(cargo);
      return this.proyectarCargoFinanciero({
        ...cargo, total, pagado: redondear(pagado), saldo: redondear(total - pagado),
      });
    });
    const saldoTotal = redondear(detalle.reduce((sum, c) => sum + c.saldo, 0));
    return {
      alumno: this.proyectarAlumnoFinanciero(alumno),
      cargos: detalle,
      pagos: pagos.map((pago) => ({
        id: pago.id, monto: pago.monto, metodo: pago.metodo, referencia: pago.referencia,
        estatus: pago.estatus, fechaPago: pago.fechaPago,
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
