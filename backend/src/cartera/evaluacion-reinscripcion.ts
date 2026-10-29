import { createHash } from 'crypto';
import { EntityManager, In } from 'typeorm';
import { GrupoMateria, Calificacion, PeriodoCalificacion, ParticipacionAsignatura, Inscripcion } from '../entities';
import { boletaPublicable } from '../reportes/publicacion-boleta';
import { esRegimenNuevo, resultadoEvaluacion } from '../common/regimen-evaluacion';
const hash = (v: unknown) => createHash('sha256').update(JSON.stringify(v)).digest('hex');
export interface MateriaPendiente {
  grupoMateriaId: number;
  materia: string;
  calificacion: number | null;
  publicada: boolean;
  participacionId?: number;
  intento?: number;
}

/** Lee resultados e intentos del origen; el llamador valida alcance y controla la transacción. */
export async function evaluarOrigenReinscripcion(m: EntityManager, origen: Inscripcion) {
  const clases = await m.getRepository(GrupoMateria).find({ where: { grupoId: origen.grupoId }, order: { id: 'ASC' } });
  const ids = clases.map((c) => c.id);
  const notas = ids.length
    ? await m.getRepository(Calificacion).find({
        where: { alumnoId: origen.alumnoId, grupoMateriaId: In(ids) },
        loadEagerRelations: false,
        order: { id: 'ASC' },
      })
    : [];
  const periodos = ids.length
    ? await m.getRepository(PeriodoCalificacion).find({ where: { grupoMateriaId: In(ids) }, order: { id: 'ASC' } })
    : [];
  const pendientes: MateriaPendiente[] = [];
  for (const c of clases) {
    const propias = notas.filter((n) => n.grupoMateriaId === c.id),
      calificacion = resultadoEvaluacion(propias, c),
      publicada = boletaPublicable([c], propias, periodos);
    if (calificacion === null || !publicada || calificacion < (esRegimenNuevo(c) ? 6 : 60))
      pendientes.push({ grupoMateriaId: c.id, materia: c.materia.nombre, calificacion, publicada });
  }
  const recursamientos = await m.getRepository(ParticipacionAsignatura).find({
    where: {
      alumnoId: origen.alumnoId,
      estado: 'ACTIVA',
      grupoMateria: { grupo: { plantelId: origen.grupo.plantelId } },
    },
    relations: { grupoMateria: { materia: true } },
    order: { id: 'ASC' },
  });
  for (const r of recursamientos)
    pendientes.push({
      grupoMateriaId: r.grupoMateriaId,
      materia: `${r.grupoMateria.materia.nombre} (recursamiento activo)`,
      calificacion: null,
      publicada: false,
      participacionId: r.id,
      intento: r.intento,
    });
  return {
    pendientes,
    sinMaterias: !clases.length,
    academicoHash: hash({
      recursamientos: recursamientos.map((r) => [r.id, r.grupoMateriaId, r.intento]),
      origen: origen.id,
      grupo: origen.grupoId,
      clases: clases.map((c) => [c.id, c.regimenEvaluacion]),
      notas: notas.map((n) => [n.id, n.parcial, Number(n.calificacion), n.escalaMaxima, n.updatedAt]),
      periodos: periodos.map((p) => [p.grupoMateriaId, p.parcial, p.estatus, p.cerradoAt, p.reabiertoAt]),
    }),
  };
}
