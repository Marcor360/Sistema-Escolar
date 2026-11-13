import { EntityManager } from 'typeorm';
import { Grupo, GrupoMateria, Inscripcion, MateriaContexto } from '../entities';
export interface PreparacionGrupo {
  asignadas: number; sinDocente: number; inscritos: number;
  esperadas: number | null; pendientes: number | null;
}
/** Solo recibe grupos ya autorizados. Tres agregaciones por página, sin filas de alumnos ni N+1. */
export async function preparacionDeGrupos(manager: EntityManager, grupos: Grupo[]): Promise<Map<number, PreparacionGrupo>> {
  const resultado = new Map<number, PreparacionGrupo>();
  if (!grupos.length) return resultado;
  const ids = grupos.map(g=>g.id);
  const [materias, inscritos, contextos] = await Promise.all([
    manager.getRepository(GrupoMateria).createQueryBuilder('gm').leftJoin('gm.docente','d').leftJoin('d.usuario','u')
      .select('gm.grupo_id','grupo').addSelect('COUNT(*)','asignadas')
      .addSelect("SUM(CASE WHEN gm.docente_id IS NULL OR d.estatus <> 'ACTIVO' OR u.activo = :inactivo THEN 1 ELSE 0 END)",'sinDocente')
      .where('gm.grupo_id IN (:...ids)',{ids,inactivo:false}).groupBy('gm.grupo_id').getRawMany<{grupo:number;asignadas:string;sinDocente:string}>(),
    manager.getRepository(Inscripcion).createQueryBuilder('i').select('i.grupo_id','grupo').addSelect('COUNT(*)','inscritos')
      .where('i.grupo_id IN (:...ids) AND i.estatus = :estatus',{ids,estatus:'ACTIVA'}).groupBy('i.grupo_id').getRawMany<{grupo:number;inscritos:string}>(),
    manager.getRepository(Grupo).createQueryBuilder('g')
      .innerJoin(MateriaContexto,'mc','mc.periodo_academico_id = g.periodo_academico_id AND mc.activo = :activo',{activo:true})
      .innerJoin('mc.materia','m','m.activo = :activo',{activo:true})
      .leftJoin(GrupoMateria,'gm','gm.grupo_id = g.id AND gm.materia_id = mc.materia_id')
      .select('g.id','grupo').addSelect('COUNT(*)','esperadas').addSelect('SUM(CASE WHEN gm.id IS NULL THEN 1 ELSE 0 END)','pendientes')
      .where('g.id IN (:...ids)',{ids}).groupBy('g.id').getRawMany<{grupo:number;esperadas:string;pendientes:string}>(),
  ]);
  const porMaterias=new Map(materias.map(m=>[Number(m.grupo),m])), porInscritos=new Map(inscritos.map(i=>[Number(i.grupo),i])), porContextos=new Map(contextos.map(c=>[Number(c.grupo),c]));
  for(const g of grupos){
    const m=porMaterias.get(g.id), i=porInscritos.get(g.id), c=porContextos.get(g.id);
    resultado.set(g.id,{asignadas:Number(m?.asignadas ?? 0),sinDocente:Number(m?.sinDocente ?? 0),inscritos:Number(i?.inscritos ?? 0),esperadas:g.periodoAcademicoId?Number(c?.esperadas ?? 0):null,pendientes:g.periodoAcademicoId?Number(c?.pendientes ?? 0):null});
  }
  return resultado;
}
