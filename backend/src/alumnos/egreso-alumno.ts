import { ConflictException } from '@nestjs/common';
import { CicloEscolar } from '../entities/ciclo-escolar.entity';
import { Inscripcion } from '../entities/inscripcion.entity';

/** Selecciona un único ciclo cursado, sin deducir graduación de fechas ambiguas. */
export function cicloParaEgreso(inscripciones: ReadonlyArray<Pick<Inscripcion, 'id' | 'grupo'>>): CicloEscolar {
  if (!inscripciones.length) throw new ConflictException('No se puede egresar sin historial de inscripción');
  const ordenadas = [...inscripciones].sort(
    (a, b) => b.grupo.ciclo.fechaFin.localeCompare(a.grupo.ciclo.fechaFin) || b.id - a.id,
  );
  const ciclo = ordenadas[0].grupo.ciclo;
  if (ordenadas.some((i) => i.grupo.ciclo.fechaFin === ciclo.fechaFin && i.grupo.cicloId !== ciclo.id)) {
    throw new ConflictException('Hay ciclos finales coincidentes; Control Escolar debe revisar el historial antes de egresar');
  }
  if (ciclo.estado !== 'CERRADO') {
    throw new ConflictException('Para egresar, el ciclo escolar más reciente debe estar cerrado con sus calificaciones validadas');
  }
  return ciclo;
}

/** Cinco años calendario desde la fecha efectiva de egreso, no desde la matrícula. */
export function fechaElegibleArchivo(fechaEgreso: Date): Date {
  const limite = new Date(fechaEgreso.getTime());
  limite.setUTCFullYear(limite.getUTCFullYear() + 5);
  return limite;
}
