import { esMaestroRestringido, puedeConsultarAcademico, puedeAdministrarFinanzas } from '../common/politica-acceso';
import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ScopeService } from '../planteles/scope.service';
import { JwtUser } from '../common/current-user.decorator';
import { CicloEscolar, GrupoMateria, Calificacion, Inscripcion, Actividad, Entrega, Cargo, Pago } from '../entities';
import { REGIMEN_NUEVO } from '../common/regimen-evaluacion';
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
    const maestro = esMaestroRestringido(user);
    let planteles:number[]|null;
    if(maestro&&!puedeAdministrarFinanzas(user)){
      const asignaciones=await this.ds.getRepository(GrupoMateria).createQueryBuilder('gm').innerJoin('gm.grupo','g').innerJoin('gm.docente','d').select('g.plantel_id','plantel').distinct(true).where('d.usuario_id=:sub AND d.estatus=:estatus AND g.ciclo_id=:ciclo',{sub:user.sub,estatus:'ACTIVO',ciclo:ciclo.id}).getRawMany<{plantel:number}>();
      planteles=asignaciones.map(a=>Number(a.plantel));
      if(query.plantelId){if(!planteles.includes(query.plantelId))throw new ForbiddenException('Plantel sin clases asignadas');planteles=[query.plantelId];}
    }else planteles=await this.scope.resolverFiltro(user,query.plantelId);
    let academico: { clases: unknown[]; regla: string } | undefined;
    if (puedeConsultarAcademico(user)) {
      const qb = this.ds.getRepository(GrupoMateria).createQueryBuilder('gm').innerJoin('gm.grupo', 'g').innerJoin('gm.materia', 'm').innerJoin('g.plantel', 'p')
        .select('gm.id', 'clase').addSelect('gm.regimen_evaluacion', 'regimenEvaluacion').addSelect('g.id', 'grupoId').addSelect('g.nombre', 'grupo').addSelect('m.nombre', 'materia').addSelect('p.nombre', 'plantel')
        .where('g.ciclo_id = :ciclo', { ciclo: ciclo.id });
      if (!historico) qb.andWhere('g.activo = :activo AND m.activo = :activo AND p.activo = :activo', { activo: true });
      if (maestro) qb.innerJoin('gm.docente', 'd').andWhere('d.usuario_id = :usuario AND d.estatus = :docenteActivo', { usuario: user.sub, docenteActivo: 'ACTIVO' });
      if (planteles !== null) {if(planteles.length)qb.andWhere('g.plantel_id IN (:...planteles)', { planteles });else qb.andWhere('1=0');}
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
          .where('gm.id IN (:...ids) AND n.parcial IN (0,1,2,3,4)', params);
        if (!historico) notas.andWhere(vigencia);
        const normalizada = `n.calificacion * CASE WHEN gm.regimen_evaluacion = '${REGIMEN_NUEVO}' THEN 10.0 ELSE 100.0 END / n.escala_maxima`;
        const parciales = await notas.clone().andWhere('n.parcial IN (1,2,3,4)').select('gm.id', 'clase').addSelect('n.parcial', 'parcial').addSelect('COUNT(*)', 'capturados').addSelect(`AVG(${normalizada})`, 'promedio')
          .groupBy('gm.id').addGroupBy('n.parcial').getRawMany<Fila>();
        // Misma semántica de resultadoEvaluacion: solo Final registrada en el régimen nuevo.
        const nuevos = `MAX(CASE WHEN gm.regimen_evaluacion = '${REGIMEN_NUEVO}' THEN 1 ELSE 0 END)`;
        const suma3 = `SUM(CASE WHEN n.parcial IN (1,2,3) THEN ${normalizada} ELSE 0 END)`;
        const cuenta3 = 'SUM(CASE WHEN n.parcial IN (1,2,3) THEN 1 ELSE 0 END)';
        const resultado = `CASE WHEN ${nuevos}=1 THEN CAST(MAX(CASE WHEN n.parcial=0 THEN ${normalizada} ELSE NULL END) AS DECIMAL(18,8)) ELSE CAST(CASE WHEN ${cuenta3}=3 THEN ROUND(${suma3}/3.0,1) ELSE NULL END AS DECIMAL(18,8)) END`;
        const porAlumno = notas.clone().select('gm.id', 'clase').addSelect('n.alumno_id', 'alumno').addSelect(resultado, 'promedio').addSelect(`CASE WHEN ${nuevos}=1 THEN 6 ELSE 60 END`, 'minima')
          .groupBy('gm.id').addGroupBy('n.alumno_id');
        const oficiales = await this.ds.createQueryBuilder().select('o.clase', 'clase').addSelect('COUNT(*)', 'completos').addSelect('AVG(o.promedio)', 'promedio')
          .addSelect('SUM(CASE WHEN o.promedio >= o.minima THEN 1 ELSE 0 END)', 'aprobados').from(`(${porAlumno.getQuery()})`, 'o').where('o.promedio IS NOT NULL').setParameters(porAlumno.getParameters()).groupBy('o.clase').getRawMany<Fila>();
        const tareas = this.ds.getRepository(Actividad).createQueryBuilder('t').where('t.grupo_materia_id IN (:...ids) AND t.fecha_entrega < :ahora', { ids, ahora: new Date() });
        if (!historico) tareas.andWhere('t.activo = :activo', { activo: true });
        const vencidas = await tareas.clone().select('t.grupo_materia_id', 'clase').addSelect('COUNT(*)', 'cantidad').groupBy('t.grupo_materia_id').getRawMany<Fila>();
        const entregadas = tareas.clone().innerJoin(Entrega, 'e', 'e.actividad_id = t.id').innerJoin(GrupoMateria, 'gm', 'gm.id = t.grupo_materia_id')
          .innerJoin(Inscripcion, 'i', 'i.grupo_id = gm.grupo_id AND i.alumno_id = e.alumno_id').innerJoin('i.alumno', 'a').innerJoin('a.usuario', 'u');
        if (!historico) entregadas.andWhere(vigencia, params);
        const recibidas = await entregadas.select('t.grupo_materia_id', 'clase').addSelect('COUNT(*)', 'cantidad').groupBy('t.grupo_materia_id').getRawMany<Fila>();
        const r = mapa(conteos), o = mapa(oficiales), v = mapa(vencidas), e = mapa(recibidas);
        const parcialMapa = new Map(parciales.map((p) => [`${p.clase}:${p.parcial}`, p]));
        academico = { regla: 'Por régimen: P1–P4 al 25% o Final manual, escala 0–10 y mínima 6; histórico P1–P3/0–100 y referencia 60. Sin redondeo automático nuevo. Histórico: participantes inscritos alguna vez; vigente: inscripción, alumno y usuario activos.', clases: clases.map((c) => {
          const id = Number(c.clase), participantes = Number(r.get(id)?.participantes ?? 0), vigentes = Number(r.get(id)?.vigentes ?? 0);
          const inscritos = historico ? participantes : vigentes, completos = Number(o.get(id)?.completos ?? 0), aprobados = Number(o.get(id)?.aprobados ?? 0);
          const esperadas = Number(v.get(id)?.cantidad ?? 0) * inscritos, recibidas = Number(e.get(id)?.cantidad ?? 0);
          return { grupoMateriaId: id, grupo: c.grupo, materia: c.materia, plantel: c.plantel, inscritos, participantesHistoricos: participantes, inscritosVigentes: vigentes,
            oficialesCompletos: completos, promedioOficial: completos ? Number(o.get(id)?.promedio) : null, aprobados, bajoReferencia: completos - aprobados,
            escalaMaxima: c.regimenEvaluacion === REGIMEN_NUEVO ? 10 : 100, parciales: (c.regimenEvaluacion === REGIMEN_NUEVO ? [1,2,3,4] : [1,2,3]).map((parcial) => { const p = parcialMapa.get(`${id}:${parcial}`); return { parcial, capturados: Number(p?.capturados ?? 0), faltantes: inscritos - Number(p?.capturados ?? 0), promedio: p ? Number(p.promedio) : null }; }),
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
