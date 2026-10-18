import { EntityManager } from 'typeorm';
import { ParticipacionAsignatura } from '../entities/participacion-asignatura.entity';
function vigentes(m: EntityManager) {
  return m.getRepository(ParticipacionAsignatura).createQueryBuilder('r').innerJoin('r.alumno','a').innerJoin('a.usuario','u').innerJoin('r.grupoMateria','gm').innerJoin('gm.grupo','g').innerJoin('g.ciclo','c').innerJoin('g.plantel','p')
    .where('r.estado = :estado AND u.activo = :activo AND g.activo = :activo AND c.activo = :activo AND p.activo = :activo AND a.plantel_id = g.plantel_id', { estado: 'ACTIVA', activo: true })
    .andWhere('a.estatus = :alumnoActivo', { alumnoActivo: 'ACTIVO' });
}
export async function clasesRecursadas(m: EntityManager, alumnoId: number): Promise<number[]> {
  const filas = await vigentes(m).andWhere('r.alumno_id = :alumnoId', { alumnoId }).getMany();
  return filas.map(r=>r.grupoMateriaId);
}
export async function recursaClase(m: EntityManager, usuarioId: number, grupoMateriaId: number): Promise<boolean> {
  return (await vigentes(m).andWhere('a.usuario_id = :usuarioId AND r.grupo_materia_id = :grupoMateriaId', { usuarioId, grupoMateriaId }).getCount()) > 0;
}
