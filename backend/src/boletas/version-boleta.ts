import { createHash } from 'crypto';
import type { GrupoMateria, Calificacion } from '../entities';
import { esRegimenNuevo, resultadoEvaluacion } from '../common/regimen-evaluacion';
export function versionAcademicaBoleta(inscripcionId: number, clases: GrupoMateria[], notas: Calificacion[]) {
  const filas = clases.map((gm) => {
    const registros = notas.filter((n) => n.grupoMateriaId === gm.id);
    return {
      grupoMateriaId: gm.id,
      asignatura: gm.materia.nombre,
      promedioFinal: resultadoEvaluacion(registros, gm),
      observaciones:
        (registros.find((n) => n.parcial === 0) ?? registros.find((n) => n.parcial === (esRegimenNuevo(gm) ? 4 : 3)))
          ?.observaciones ?? '',
    };
  });
  return { hash: createHash('sha256').update(JSON.stringify({ inscripcionId, filas })).digest('hex'), filas };
}
