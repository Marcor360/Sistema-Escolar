import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, LessThan, Repository } from 'typeorm';
import { Cargo } from '../entities/cargo.entity';
import { Pago } from '../entities/pago.entity';
import { Inscripcion } from '../entities/inscripcion.entity';
import { Grupo } from '../entities/grupo.entity';
import { AlumnosService } from '../alumnos/alumnos.service';
import { ConceptosService } from './conceptos.service';
import { BitacoraFinancieraService } from './bitacora-financiera.service';
import { JwtUser } from '../common/current-user.decorator';
import { AplicarRecargosDto, CrearCargoDto, GenerarColegiaturasDto } from './finanzas.dto';

const redondear = (n: number) => Math.round(n * 100) / 100;

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
  ) {}

  totalDeCargo(cargo: Cargo): number {
    return redondear(cargo.monto - cargo.descuento + cargo.recargo);
  }

  /** Suma de pagos confirmados por cargo, en UNA consulta agrupada (evita N+1). */
  async pagadoPorCargo(cargoIds: number[]): Promise<Map<number, number>> {
    if (cargoIds.length === 0) return new Map();
    const filas = await this.pagos
      .createQueryBuilder('p')
      .select('p.cargo_id', 'cargoId')
      .addSelect('SUM(p.monto)', 'pagado')
      .where('p.estatus = :e', { e: 'CONFIRMADO' })
      .andWhere('p.cargo_id IN (:...ids)', { ids: cargoIds })
      .groupBy('p.cargo_id')
      .getRawMany<{ cargoId: number; pagado: string }>();
    return new Map(filas.map((f) => [Number(f.cargoId), redondear(Number(f.pagado))]));
  }

  listar(filtro: { alumnoId?: number; estatus?: string; periodo?: string }) {
    const where: Record<string, unknown> = {};
    if (filtro.alumnoId) where.alumnoId = filtro.alumnoId;
    if (filtro.estatus) where.estatus = filtro.estatus;
    if (filtro.periodo) where.periodo = filtro.periodo;
    return this.cargos.find({ where, order: { fechaVencimiento: 'ASC' }, take: 500 });
  }

  async obtener(id: number) {
    const cargo = await this.cargos.findOne({ where: { id } });
    if (!cargo) throw new NotFoundException('Cargo no encontrado');
    return cargo;
  }

  async crear(dto: CrearCargoDto, user: JwtUser) {
    await this.conceptos.obtener(dto.conceptoId);
    await this.alumnos.obtener(dto.alumnoId);
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
    await this.bitacora.registrar(user.sub, 'CREAR_CARGO', 'cargo', cargo.id, `${dto.descripcion} $${dto.monto}`);
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

    const gruposDelCiclo = await this.grupos.find({ where: { cicloId: dto.cicloId } });
    if (gruposDelCiclo.length === 0) return { generados: 0, omitidos: 0 };

    const inscripciones = await this.inscripciones.find({
      where: { grupoId: In(gruposDelCiclo.map((g) => g.id)), estatus: 'ACTIVA' },
    });
    const alumnoIds = [...new Set(inscripciones.map((i) => i.alumnoId))];
    if (alumnoIds.length === 0) return { generados: 0, omitidos: 0 };

    const existentes = await this.cargos.find({
      select: { alumnoId: true },
      where: { conceptoId: concepto.id, periodo: dto.periodo, alumnoId: In(alumnoIds) },
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
          descripcion: `Colegiatura ${dto.periodo}`,
          monto,
          fechaVencimiento: vencimiento,
        }),
      );
    if (nuevos.length > 0) await this.cargos.save(nuevos);

    await this.bitacora.registrar(
      user.sub, 'GENERAR_COLEGIATURAS', 'cargo', null,
      `periodo=${dto.periodo} generados=${nuevos.length}`,
    );
    return { generados: nuevos.length, omitidos: yaGenerados.size, vencimiento };
  }

  /** Aplica recargo a cargos vencidos sin liquidar (una sola vez por cargo). */
  async aplicarRecargos(dto: AplicarRecargosDto, user: JwtUser) {
    const porcentaje = dto.porcentaje ?? 10;
    const hoy = new Date().toISOString().slice(0, 10);
    const vencidos = await this.cargos.find({
      where: { estatus: In(['PENDIENTE', 'PARCIAL']), fechaVencimiento: LessThan(hoy) },
    });

    const modificados: Cargo[] = [];
    for (const cargo of vencidos) {
      if (cargo.recargo > 0) continue;
      cargo.recargo = redondear((cargo.monto - cargo.descuento) * (porcentaje / 100));
      cargo.estatus = 'VENCIDO';
      modificados.push(cargo);
    }
    if (modificados.length > 0) await this.cargos.save(modificados);
    await this.bitacora.registrar(user.sub, 'APLICAR_RECARGOS', 'cargo', null, `${porcentaje}% a ${modificados.length} cargos`);
    return { aplicados: modificados.length, porcentaje };
  }

  /** Recalcula el estatus de un cargo con base en sus pagos confirmados. */
  async recalcularEstatus(cargoId: number) {
    const cargo = await this.cargos.findOne({ where: { id: cargoId } });
    if (!cargo || cargo.estatus === 'CANCELADO') return;
    const pagado = (await this.pagadoPorCargo([cargoId])).get(cargoId) ?? 0;
    const total = this.totalDeCargo(cargo);
    cargo.estatus = pagado >= total ? 'PAGADO' : pagado > 0 ? 'PARCIAL' : cargo.estatus;
    await this.cargos.save(cargo);
  }

  /** Saldo vivo de un cargo (para órdenes de pago). */
  async saldoDeCargo(cargo: Cargo): Promise<number> {
    const pagado = (await this.pagadoPorCargo([cargo.id])).get(cargo.id) ?? 0;
    return redondear(this.totalDeCargo(cargo) - pagado);
  }

  /** Cargos con saldo pendiente en todo el plantel (sin N+1). */
  async adeudos(): Promise<CargoConSaldo[]> {
    const cargos = await this.cargos.find({
      where: { estatus: In(['PENDIENTE', 'PARCIAL', 'VENCIDO']) },
      order: { fechaVencimiento: 'ASC' },
    });
    const pagado = await this.pagadoPorCargo(cargos.map((c) => c.id));
    return cargos
      .map((cargo) => {
        const total = this.totalDeCargo(cargo);
        const abonado = pagado.get(cargo.id) ?? 0;
        return { ...cargo, total, pagado: abonado, saldo: redondear(total - abonado) } as CargoConSaldo;
      })
      .filter((c) => c.saldo > 0);
  }

  /** Estado de cuenta de un alumno: cargos con saldos + historial de pagos. */
  async estadoDeCuenta(alumnoId: number) {
    const alumno = await this.alumnos.obtener(alumnoId);
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
      return { ...cargo, total, pagado: redondear(pagado), saldo: redondear(total - pagado) };
    });
    const saldoTotal = redondear(detalle.reduce((sum, c) => sum + c.saldo, 0));
    return { alumno, cargos: detalle, pagos, saldoTotal };
  }

  async miEstadoDeCuenta(user: JwtUser) {
    const alumno = await this.alumnos.obtenerPorUsuario(user.sub);
    return this.estadoDeCuenta(alumno.id);
  }
}
