import { EntityManager, In } from 'typeorm';
import {
  Calificacion,
  CalificacionRecursamiento,
  GrupoMateria,
  Inscripcion,
  ParticipacionAsignatura,
  PeriodoCalificacion,
} from '../entities';
import { resultadoEvaluacion, escalaDe } from '../common/regimen-evaluacion';
import { boletaPublicable } from '../reportes/publicacion-boleta';

export async function historialEgreso(m: EntityManager, alumnoId: number) {
  const inscripciones = await m.find(Inscripcion, { where: { alumnoId }, order: { id: 'ASC' } });
  const intentos = await m.find(ParticipacionAsignatura, { where: { alumnoId }, order: { id: 'ASC' } });
  const grupos = inscripciones.map((i) => i.grupoId);
  const clases = await m.find(GrupoMateria, {
    where: [{ grupoId: In(grupos) }, { id: In(intentos.map((p) => p.grupoMateriaId)) }],
    order: { id: 'ASC' },
  });
  const notas = await m.find(Calificacion, {
    where: { alumnoId },
    loadEagerRelations: false,
    order: { id: 'ASC' },
  });
  const recuperaciones = await m.find(CalificacionRecursamiento, {
    where: { participacionId: In(intentos.map((p) => p.id)) },
    order: { id: 'ASC' },
  });
  const periodos = await m.find(PeriodoCalificacion, {
    where: { grupoMateriaId: In(clases.map((c) => c.id)) },
    loadEagerRelations: false,
  });
  const fila = (
    c: GrupoMateria,
    registros: typeof notas | typeof recuperaciones,
    intento: number,
    estado: string,
  ) => ({
    claseId: c.id,
    materia: c.materia.clave,
    nombre: c.materia.nombre,
    creditos: Number(c.materia.creditos),
    carreraPlanId: c.grupo.carreraId,
    ciclo: c.grupo.ciclo.clave,
    grupo: c.grupo.nombre,
    intento,
    estado,
    resultado: resultadoEvaluacion(registros, c),
    escala: escalaDe(c),
    publicada: boletaPublicable(
      [c],
      registros.map((n) => ({ grupoMateriaId: c.id, parcial: n.parcial })),
      periodos,
    ),
    notas: registros.map((n) => ({ parcial: n.parcial, calificacion: n.calificacion, escala: n.escalaMaxima })),
  });
  const materias = clases.flatMap((c) => {
    const inscripcion = inscripciones.find((i) => i.grupoId === c.grupoId);
    const filas = inscripcion
      ? [
          fila(
            c,
            notas.filter((n) => n.grupoMateriaId === c.id),
            0,
            inscripcion.estatus,
          ),
        ]
      : [];
    for (const p of intentos.filter((p) => p.grupoMateriaId === c.id))
      filas.push(
        fila(
          c,
          recuperaciones.filter((n) => n.participacionId === p.id),
          p.intento,
          p.estado,
        ),
      );
    return filas;
  });
  return {
    inscripciones: inscripciones.map((i) => ({
      id: i.id,
      grupo: i.grupo.nombre,
      ciclo: i.grupo.ciclo.clave,
      estado: i.estatus,
    })),
    materias,
  };
}
export type HistorialEgreso = Awaited<ReturnType<typeof historialEgreso>>;
