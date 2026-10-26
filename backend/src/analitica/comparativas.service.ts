import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  CarreraPlan,
  CicloEscolar,
  GrupoMateria,
  Inscripcion,
  Pago,
  PeriodoAcademico,
  ProgramacionCobro,
} from '../entities';
import { ScopeService } from '../planteles/scope.service';
import { JwtUser } from '../common/current-user.decorator';
import { puedeAdministrarFinanzas, puedeConsultarAcademico, esMaestroRestringido } from '../common/politica-acceso';
import { ComparativasDto } from './analitica.dto';
type Fila = { id: string | number | null; nombre: string; valor: string | number };
const puntos = (filas: Fila[]) =>
  filas.map((f) => ({
    id: f.id === null ? 'sin-asignar' : String(f.id),
    etiqueta: f.nombre,
    valor: Math.round(Number(f.valor ?? 0) * 100) / 100,
  }));
export function completarMeses(filas: ReturnType<typeof puntos>, desde: string, hasta: string) {
  const resultado = [];
  let fecha = new Date(desde.slice(0, 7) + '-01T12:00:00Z');
  while (fecha.toISOString().slice(0, 7) <= hasta.slice(0, 7)) {
    const periodo = fecha.toISOString().slice(0, 7);
    resultado.push(filas.find((f) => f.id === periodo) ?? { id: periodo, etiqueta: periodo, valor: 0 });
    fecha = new Date(Date.UTC(fecha.getUTCFullYear(), fecha.getUTCMonth() + 1, 1, 12));
  }
  return resultado;
}
const mes = (columna: string) =>
  `CONCAT(YEAR(${columna}), '-', CASE WHEN MONTH(${columna})<10 THEN '0' ELSE '' END, MONTH(${columna}))`;
@Injectable()
export class ComparativasService {
  constructor(
    private readonly ds: DataSource,
    private readonly scope: ScopeService,
  ) {}
  async consultar(q: ComparativasDto, u: JwtUser) {
    if (q.grupoId || q.materiaId)
      throw new BadRequestException('Las comparativas se filtran por ciclo, plantel e intervalo');
    const ciclo = await this.ds.getRepository(CicloEscolar).findOneBy(q.cicloId ? { id: q.cicloId } : { activo: true });
    if (!ciclo) throw new NotFoundException('Selecciona un ciclo existente');
    const desde = q.desde ?? ciclo.fechaInicio,
      hasta = q.hasta ?? ciclo.fechaFin;
    if (hasta < desde || Date.parse(hasta) - Date.parse(desde) > 366 * 5 * 86400000)
      throw new BadRequestException('Selecciona un intervalo válido de hasta cinco años');
    const inicio = new Date(desde + 'T00:00:00-06:00'),
      fin = new Date(new Date(hasta + 'T00:00:00-06:00').getTime() + 86400000);
    let planteles: number[] | null = null;
    let academicos: number[] | null = null;
    if (puedeAdministrarFinanzas(u)) {
      planteles = await this.scope.resolverFiltro(u, q.plantelId);
      academicos = planteles;
    }
    if (esMaestroRestringido(u)) {
      const filas = await this.ds
        .getRepository(GrupoMateria)
        .createQueryBuilder('gm')
        .innerJoin('gm.grupo', 'g')
        .innerJoin('gm.docente', 'd')
        .select('g.plantel_id', 'plantel')
        .distinct(true)
        .where('d.usuario_id=:sub AND d.estatus=:estatus AND g.ciclo_id=:ciclo', {
          sub: u.sub,
          estatus: 'ACTIVO',
          ciclo: ciclo.id,
        })
        .getRawMany<{ plantel: number }>();
      academicos = filas.map((f) => Number(f.plantel));
      if (q.plantelId) {
        if (!puedeAdministrarFinanzas(u) && !academicos.includes(q.plantelId))
          throw new ForbiddenException('El plantel no contiene clases asignadas');
        academicos = academicos.includes(q.plantelId) ? [q.plantelId] : [];
      }
    }

    let financiero, inscripciones;
    if (puedeAdministrarFinanzas(u)) {
      const qb = this.ds
        .getRepository(Pago)
        .createQueryBuilder('p')
        .innerJoin('p.cargo', 'c')
        .innerJoin('p.plantel', 'pl')
        .where('p.estatus=:confirmado AND c.ciclo_id=:ciclo AND p.fecha_pago>=:inicio AND p.fecha_pago<:fin', {
          confirmado: 'CONFIRMADO',
          ciclo: ciclo.id,
          inicio,
          fin,
        });
      if (planteles !== null) qb.andWhere('p.plantel_id IN (:...planteles)', { planteles });
      const porPlantel = await qb
        .clone()
        .select('p.plantel_id', 'id')
        .addSelect('pl.nombre', 'nombre')
        .addSelect('SUM(p.monto)', 'valor')
        .groupBy('p.plantel_id')
        .addGroupBy('pl.nombre')
        .orderBy('SUM(p.monto)', 'DESC')
        .getRawMany<Fila>();
      const carreras = qb
        .clone()
        .leftJoin(
          ProgramacionCobro,
          'pc',
          "c.clave_generacion LIKE CONCAT('PROGRAMACION:',pc.id,':%') AND pc.plantel_id=c.plantel_id AND pc.plantel_id=p.plantel_id AND pc.alumno_id=c.alumno_id AND pc.ciclo_id=c.ciclo_id",
        )
        .leftJoin(
          PeriodoAcademico,
          'pe',
          'pe.id=pc.periodo_academico_id AND pe.plantel_id=c.plantel_id AND pe.ciclo_id=c.ciclo_id',
        )
        .leftJoin(CarreraPlan, 'ca', 'ca.id=pe.carrera_id AND ca.plantel_id=c.plantel_id');
      const porCarrera = await carreras
        .select('ca.id', 'id')
        .addSelect(
          "CASE WHEN ca.id IS NULL THEN 'Sin carrera identificada' ELSE CONCAT(ca.nombre,' · ',MAX(pl.nombre)) END",
          'nombre',
        )
        .addSelect('SUM(p.monto)', 'valor')
        .groupBy('ca.id')
        .addGroupBy('ca.nombre')
        .orderBy('SUM(p.monto)', 'DESC')
        .getRawMany<Fila>();
      const porMes = await qb
        .clone()
        .select(mes('p.fecha_pago'), 'id')
        .addSelect(mes('p.fecha_pago'), 'nombre')
        .addSelect('SUM(p.monto)', 'valor')
        .groupBy(mes('p.fecha_pago'))
        .orderBy(mes('p.fecha_pago'), 'ASC')
        .getRawMany<Fila>();
      financiero = {
        porPlantel: puntos(porPlantel),
        porCarrera: puntos(porCarrera),
        porMes: completarMeses(puntos(porMes), desde, hasta),
        base: 'Pagos confirmados aplicados a cargos del ciclo, por fecha de pago y plantel de origen. Carrera identificada únicamente mediante programación y periodo; otros cobros se separan. Ingreso no equivale a utilidad.',
      };
    }
    if (puedeConsultarAcademico(u)) {
      const qb = this.ds
        .getRepository(Inscripcion)
        .createQueryBuilder('i')
        .innerJoin('i.grupo', 'g')
        .innerJoin('g.plantel', 'pl')
        .leftJoin('g.carrera', 'ca')
        .where('g.ciclo_id=:ciclo', { ciclo: ciclo.id });
      if (ciclo.estado !== 'CERRADO')
        qb.innerJoin('i.alumno', 'a')
          .innerJoin('a.usuario', 'u')
          .andWhere('i.estatus=:activa AND a.estatus=:alumno AND u.activo=:activo AND g.activo=:activo', {
            activa: 'ACTIVA',
            alumno: 'ACTIVO',
            activo: true,
          });
      if (academicos !== null) {
        if (academicos.length) qb.andWhere('g.plantel_id IN (:...academicos)', { academicos });
        else qb.andWhere('1=0');
      }
      if (esMaestroRestringido(u))
        qb.andWhere(
          'EXISTS (SELECT 1 FROM grupo_materias gm INNER JOIN docentes d ON d.id=gm.docente_id WHERE gm.grupo_id=g.id AND d.usuario_id=:sub AND d.estatus=:estatusDocente)',
          { sub: u.sub, estatusDocente: 'ACTIVO' },
        );
      const ventana = qb.clone().andWhere('i.fecha_inscripcion>=:inicio AND i.fecha_inscripcion<:fin', { inicio, fin });
      const porPlantel = await ventana
        .clone()
        .select('g.plantel_id', 'id')
        .addSelect('pl.nombre', 'nombre')
        .addSelect('COUNT(DISTINCT i.alumno_id)', 'valor')
        .groupBy('g.plantel_id')
        .addGroupBy('pl.nombre')
        .orderBy('COUNT(DISTINCT i.alumno_id)', 'DESC')
        .getRawMany<Fila>();
      const porCarrera = await ventana
        .clone()
        .select('ca.id', 'id')
        .addSelect(
          "CASE WHEN ca.id IS NULL THEN 'Sin carrera configurada' ELSE CONCAT(ca.nombre,' · ',MAX(pl.nombre)) END",
          'nombre',
        )
        .addSelect('COUNT(DISTINCT i.alumno_id)', 'valor')
        .groupBy('ca.id')
        .addGroupBy('ca.nombre')
        .orderBy('COUNT(DISTINCT i.alumno_id)', 'DESC')
        .getRawMany<Fila>();
      const primeras = qb
        .clone()
        .select('i.alumno_id', 'alumno')
        .addSelect('MIN(i.fecha_inscripcion)', 'fecha')
        .groupBy('i.alumno_id');
      const porMes = await this.ds
        .createQueryBuilder()
        .select(mes('altas.fecha'), 'id')
        .addSelect(mes('altas.fecha'), 'nombre')
        .addSelect('COUNT(*)', 'valor')
        .from('(' + primeras.getQuery() + ')', 'altas')
        .setParameters(primeras.getParameters())
        .where('altas.fecha>=:inicio AND altas.fecha<:fin', { inicio, fin })
        .groupBy(mes('altas.fecha'))
        .orderBy(mes('altas.fecha'), 'ASC')
        .getRawMany<Fila>();
      inscripciones = {
        porPlantel: puntos(porPlantel),
        porCarrera: puntos(porCarrera),
        porMes: completarMeses(puntos(porMes), desde, hasta),
        base: 'Alumnos distintos por plantel/carrera con inscripción en el intervalo; un alumno puede aparecer en varias categorías. Evolución: primera inscripción del alumno en el ciclo dentro del alcance. Ciclo cerrado incluye participación histórica; vigente excluye bajas.',
      };
    }
    return {
      ciclo: { id: ciclo.id, nombre: ciclo.nombre },
      desde,
      hasta,
      generadoEn: new Date().toISOString(),
      ...(financiero ? { financiero } : {}),
      ...(inscripciones ? { inscripciones } : {}),
    };
  }
}
