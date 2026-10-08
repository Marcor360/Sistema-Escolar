import { esMaestroRestringido, puedeConsultarAcademico, puedeAdministrarFinanzas } from '../common/politica-acceso';
import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ScopeService } from '../planteles/scope.service';
import { JwtUser } from '../common/current-user.decorator';
import { CicloEscolar, GrupoMateria, Calificacion, Inscripcion, Actividad, Entrega, Cargo, Pago } from '../entities';
import { PARCIALES_OFICIALES, PROMEDIO_OFICIAL_SQL } from '../common/promedio-oficial';
import { AnaliticaDto } from './analitica.dto';
type Fila = Record<string, string | number | null>;
const mapa = (filas: Fila[]) => new Map(filas.map((r) => [Number(r.clase), r]));
@Injectable()
export class AnaliticaService {
  constructor(private readonly ds: DataSource, private readonly scope: ScopeService) {}
  async consultar(query: AnaliticaDto, user: JwtUser) {
    const ciclo = await this.ds.getRepository(CicloEscolar).findOne({ where: query.cicloId ? { id: query.cicloId } : { activo: true } });
    if (!ciclo) throw new NotFoundException('Selecciona un ciclo existente');
    const historico = ciclo.estado === 'CERRADO';
    const planteles = await this.scope.resolverFiltro(user, query.plantelId);
    const maestro = esMaestroRestringido(user);
    let academico: { clases: unknown[]; regla: string } | undefined;
    if (puedeConsultarAcademico(user)) {
      const qb = this.ds.getRepository(GrupoMateria).createQueryBuilder('gm').innerJoin('gm.grupo', 'g').innerJoin('gm.materia', 'm').innerJoin('g.plantel', 'p')
        .select('gm.id', 'clase').addSelect('g.id', 'grupoId').addSelect('g.nombre', 'grupo').addSelect('m.nombre', 'materia').addSelect('p.nombre', 'plantel')
        .where('g.ciclo_id = :ciclo', { ciclo: ciclo.id });
      if (!historico) qb.andWhere('g.activo = :activo AND m.activo = :activo AND p.activo = :activo', { activo: true });
      if (maestro) qb.innerJoin('gm.docente', 'd').andWhere('d.usuario_id = :usuario AND d.estatus = :docenteActivo', { usuario: user.sub, docenteActivo: 'ACTIVO' });
      if (planteles !== null) qb.andWhere('g.plantel_id IN (:...planteles)', { planteles });
      if (query.grupoId) qb.andWhere('g.id = :grupo', { grupo: query.grupoId });
      if (query.materiaId) qb.andWhere('gm.materia_id = :materia', { materia: query.materiaId });
      const clases = await qb.orderBy('gm.id', 'ASC').getRawMany<Fila>();
      const ids = clases.map((c) => Number(c.clase));
      if (!ids.length) academico = { clases: [], regla: 'Sin clases dentro del alcance seleccionado.' };
      else {
        const vigencia = 'i.estatus = :insc AND a.estatus = :alumno AND u.activo = :activo';
        const params = { ids, insc: 'ACTIVA', alumno: 'ACTIVO', activo: true };
        const roster = this.ds.getRepository(Inscripcion).createQueryBuilder('i').innerJoin('i.alumno', 'a').innerJoin('a.usuario', 'u')
          .innerJoin(GrupoMateria, 'gm', 'gm.grupo_id = i.grupo_id').where('gm.id IN (:...ids)', params);
        const conteos = await roster.clone().select('gm.id', 'clase').addSelect('COUNT(*)', 'participantes')
          .addSelect(`SUM(CASE WHEN ${vigencia} THEN 1 ELSE 0 END)`, 'vigentes').groupBy('gm.id').getRawMany<Fila>();
        const notas = this.ds.getRepository(Calificacion).createQueryBuilder('n').innerJoin('n.grupoMateria', 'gm')
          .innerJoin(Inscripcion, 'i', 'i.grupo_id = gm.grupo_id AND i.alumno_id = n.alumno_id').innerJoin('i.alumno', 'a').innerJoin('a.usuario', 'u')
          .where('gm.id IN (:...ids) AND n.parcial IN (1,2,3)', params);
        if (!historico) notas.andWhere(vigencia);
        const parciales = await notas.clone().select('gm.id', 'clase').addSelect('n.parcial', 'parcial').addSelect('COUNT(*)', 'capturados').addSelect('AVG(n.calificacion)', 'promedio')
          .groupBy('gm.id').addGroupBy('n.parcial').getRawMany<Fila>();
        // La misma fórmula oficial P1-P3 completos, redondeada por alumno antes de agregar.
        const porAlumno = notas.clone().select('gm.id', 'clase').addSelect('n.alumno_id', 'alumno').addSelect(PROMEDIO_OFICIAL_SQL, 'promedio')
          .groupBy('gm.id').addGroupBy('n.alumno_id').having(`COUNT(*) = ${PARCIALES_OFICIALES.length}`);
        const oficiales = await this.ds.createQueryBuilder().select('o.clase', 'clase').addSelect('COUNT(*)', 'completos').addSelect('AVG(o.promedio)', 'promedio')
          .addSelect('SUM(CASE WHEN o.promedio >= 60 THEN 1 ELSE 0 END)', 'aprobados').from(`(${porAlumno.getQuery()})`, 'o').setParameters(porAlumno.getParameters()).groupBy('o.clase').getRawMany<Fila>();
        const tareas = this.ds.getRepository(Actividad).createQueryBuilder('t').where('t.grupo_materia_id IN (:...ids) AND t.fecha_entrega < :ahora', { ids, ahora: new Date() });
        if (!historico) tareas.andWhere('t.activo = :activo', { activo: true });
        const vencidas = await tareas.clone().select('t.grupo_materia_id', 'clase').addSelect('COUNT(*)', 'cantidad').groupBy('t.grupo_materia_id').getRawMany<Fila>();
        const entregadas = tareas.clone().innerJoin(Entrega, 'e', 'e.actividad_id = t.id').innerJoin(GrupoMateria, 'gm', 'gm.id = t.grupo_materia_id')
          .innerJoin(Inscripcion, 'i', 'i.grupo_id = gm.grupo_id AND i.alumno_id = e.alumno_id').innerJoin('i.alumno', 'a').innerJoin('a.usuario', 'u');
        if (!historico) entregadas.andWhere(vigencia, params);
        const recibidas = await entregadas.select('t.grupo_materia_id', 'clase').addSelect('COUNT(*)', 'cantidad').groupBy('t.grupo_materia_id').getRawMany<Fila>();
        const r = mapa(conteos), o = mapa(oficiales), v = mapa(vencidas), e = mapa(recibidas);
        const parcialMapa = new Map(parciales.map((p) => [`${p.clase}:${p.parcial}`, p]));
        academico = { regla: 'P1-P3 completos; aprobación orientativa >=60. Histórico: participantes inscritos alguna vez, incluso BAJA; vigente: solo inscripción, alumno y usuario activos.', clases: clases.map((c) => {
          const id = Number(c.clase), participantes = Number(r.get(id)?.participantes ?? 0), vigentes = Number(r.get(id)?.vigentes ?? 0);
          const inscritos = historico ? participantes : vigentes, completos = Number(o.get(id)?.completos ?? 0), aprobados = Number(o.get(id)?.aprobados ?? 0);
          const esperadas = Number(v.get(id)?.cantidad ?? 0) * inscritos, recibidas = Number(e.get(id)?.cantidad ?? 0);
          return { grupoMateriaId: id, grupo: c.grupo, materia: c.materia, plantel: c.plantel, inscritos, participantesHistoricos: participantes, inscritosVigentes: vigentes,
            oficialesCompletos: completos, promedioOficial: completos ? Math.round(Number(o.get(id)?.promedio) * 10) / 10 : null, aprobados, bajoReferencia: completos - aprobados,
            parciales: [1,2,3].map((parcial) => { const p = parcialMapa.get(`${id}:${parcial}`); return { parcial, capturados: Number(p?.capturados ?? 0), faltantes: inscritos - Number(p?.capturados ?? 0), promedio: p ? Math.round(Number(p.promedio) * 10) / 10 : null }; }),
            entregasEsperadas: esperadas, entregasRecibidas: recibidas, entregasFaltantes: esperadas - recibidas };
        }) };
      }
    }
    let financiero: { cargos: number; facturado: number; aplicado: number; saldo: number } | undefined;
    if (puedeAdministrarFinanzas(user)) {
      const cargos = this.ds.getRepository(Cargo).createQueryBuilder('c').where('c.ciclo_id = :ciclo AND c.estatus <> :cancelado', { ciclo: ciclo.id, cancelado: 'CANCELADO' });
      if (planteles !== null) cargos.andWhere('c.plantel_id IN (:...planteles)', { planteles });
      const total = await cargos.clone().select('COUNT(*)', 'cargos').addSelect('COALESCE(SUM(c.monto - c.descuento + c.recargo),0)', 'facturado').getRawOne<Fila>();
      const pagos = await cargos.clone().innerJoin(Pago, 'p', 'p.cargo_id = c.id AND p.estatus = :confirmado', { confirmado: 'CONFIRMADO' }).select('COALESCE(SUM(p.monto),0)', 'aplicado').getRawOne<Fila>();
      const facturado = Number(total?.facturado ?? 0), aplicado = Number(pagos?.aplicado ?? 0);
      financiero = { cargos: Number(total?.cargos ?? 0), facturado: Math.round(facturado * 100) / 100, aplicado: Math.round(aplicado * 100) / 100, saldo: Math.round((facturado - aplicado) * 100) / 100 };
    }
    return { ciclo: { id: ciclo.id, nombre: ciclo.nombre }, modo: historico ? 'HISTORICO' : 'VIGENTE', plantelId: query.plantelId ?? null, generadoEn: new Date().toISOString(), ...(academico ? { academico } : {}), ...(financiero ? { financiero } : {}) };
  }
}
