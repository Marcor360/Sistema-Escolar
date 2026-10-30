import { EntityManager, In } from 'typeorm';
import { Calificacion, GrupoMateria, Inscripcion, PeriodoCalificacion } from '../entities';
import { versionAcademicaBoleta } from './version-boleta';
import { boletaPublicable } from '../reportes/publicacion-boleta';
/** Tres consultas por lote, independientemente del número de inscripciones. */
export async function versionesBoletas(m: EntityManager, inscripciones: Inscripcion[]) {
  const resultado = new Map<
    number,
    ReturnType<typeof versionAcademicaBoleta> & { disponible: boolean; clases: GrupoMateria[] }
  >();
  if (!inscripciones.length) return resultado;
  const grupos = [...new Set(inscripciones.map((i) => i.grupoId))];
  const [clases, notas, periodos] = await Promise.all([
    m.getRepository(GrupoMateria).find({
      where: { grupoId: In(grupos) },
      loadEagerRelations: false,
      relations: { materia: true, docente: true },
      order: { id: 'ASC' },
    }),
    m.getRepository(Calificacion).find({
      where: {
        alumnoId: In([...new Set(inscripciones.map((i) => i.alumnoId))]),
        grupoMateria: { grupoId: In(grupos) },
      },
      loadEagerRelations: false,
    }),
    m
      .getRepository(PeriodoCalificacion)
      .find({ where: { grupoMateria: { grupoId: In(grupos) } }, loadEagerRelations: false }),
  ]);
  for (const i of inscripciones) {
    const propias = clases.filter((c) => c.grupoId === i.grupoId),
      ids = new Set(propias.map((c) => c.id));
    const n = notas.filter((n) => n.alumnoId === i.alumnoId && ids.has(n.grupoMateriaId));
    const p = periodos.filter((p) => ids.has(p.grupoMateriaId));
    resultado.set(i.id, {
      ...versionAcademicaBoleta(i.id, propias, n),
      disponible: boletaPublicable(propias, n, p),
      clases: propias,
    });
  }
  return resultado;
}
