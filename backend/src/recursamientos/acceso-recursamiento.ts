import { EntityManager } from 'typeorm';
import { ParticipacionAsignatura } from '../entities/participacion-asignatura.entity';
function vigentes(m: EntityManager) {
  return m.getRepository(ParticipacionAsignatura).createQueryBuilder('r').innerJoin('r.inscripcionPrincipal','ip').innerJoin('r.alumno','a').innerJoin('a.usuario','u').innerJoin('r.grupoMateria','gm').innerJoin('gm.grupo','g').innerJoin('g.ciclo','c').innerJoin('g.plantel','p')
    .where('r.estado = :estado AND ip.estatus IN (:...estadosPrincipales) AND u.activo = :activo AND g.activo = :activo AND c.activo = :activo AND p.activo = :activo AND a.plantel_id = g.plantel_id', { estado: 'ACTIVA', estadosPrincipales: ['ACTIVA','HISTORICA'], activo: true })
    .andWhere('a.estatus = :alumnoActivo', { alumnoActivo: 'ACTIVO' });
}
export async function clasesRecursadas(m: EntityManager, alumnoId: number): Promise<number[]> {
  const filas = await vigentes(m).andWhere('r.alumno_id = :alumnoId', { alumnoId }).getMany();
  return filas.map(r=>r.grupoMateriaId);
}
export async function recursaClase(m: EntityManager, usuarioId: number, grupoMateriaId: number): Promise<boolean> {
  return (await vigentes(m).andWhere('a.usuario_id = :usuarioId AND r.grupo_materia_id = :grupoMateriaId', { usuarioId, grupoMateriaId }).getCount()) > 0;
}

/** Reserva de capacidad por clase: los nuevos regulares también deben respetarla. */
export async function limiteRegulares(m: EntityManager, grupoId: number): Promise<number> {
  const { CupoRecursamiento } = await import('../entities/participacion-asignatura.entity');
  const cupos = await m.getRepository(CupoRecursamiento).find({ where: { grupoMateria: { grupoId } } });
  let limite = Number.POSITIVE_INFINITY;
  for (const c of cupos) {
    const recursantes = await m.getRepository(ParticipacionAsignatura).countBy({ grupoMateriaId: c.grupoMateriaId, estado: 'ACTIVA' });
    limite = Math.min(limite, c.cupoTotalManual - recursantes);
  }
  return limite;
}
