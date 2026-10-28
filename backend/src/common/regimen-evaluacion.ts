import { promedioOficial } from './promedio-oficial';

export const REGIMEN_NUEVO = 'CUATRO_PARCIALES_10';
export type ClaseEvaluacion = { regimenEvaluacion?: string };
export type NotaEvaluacion = { parcial: number; calificacion: number; escalaMaxima?: number };
export const esRegimenNuevo = (clase?: ClaseEvaluacion | null) => clase?.regimenEvaluacion === REGIMEN_NUEVO;
export const escalaDe = (clase: ClaseEvaluacion) => esRegimenNuevo(clase) ? 10 : 100;
export const parcialesDe = (clase: ClaseEvaluacion) => esRegimenNuevo(clase) ? [1, 2, 3, 4] : [1, 2, 3];
/** Equivalencia de lectura. Nunca modifica la nota ni la escala originales. */
export function notaEnEscala(nota: Pick<NotaEvaluacion, 'calificacion' | 'escalaMaxima'>, clase: ClaseEvaluacion): number {
  const valor = Number(nota.calificacion), origen = nota.escalaMaxima ?? 100, destino = escalaDe(clase);
  if (origen === destino) return valor;
  return Math.round(valor * 1e6) * destino / origen / 1e6;
}
export function resultadoEvaluacion(notas: NotaEvaluacion[], clase: ClaseEvaluacion): number | null {
  const mapa = new Map(notas.map(n => [n.parcial, notaEnEscala(n, clase)]));
  if (!esRegimenNuevo(clase)) return promedioOficial(mapa);
  // Solo una Final capturada/aprobada es definitiva; el promedio es una propuesta.
  return mapa.get(0) ?? null;
}
export function propuestaFinal(notas: NotaEvaluacion[], clase: ClaseEvaluacion): number | null {
  if (!esRegimenNuevo(clase)) return null;
  const mapa = new Map(notas.map(n => [n.parcial, notaEnEscala(n, clase)]));
  if (parcialesDe(clase).some(p => !mapa.has(p))) return null;
  return parcialesDe(clase).reduce((s,p) => s + Math.round(mapa.get(p)! * 1e6),0) / 4e6;
}

export interface CriterioNota { nombre: string; porcentaje: number }
/** Ponderaciones y notas a dos decimales: aritmética entera exacta, resultado a seis decimales. */
export function calcularPonderada(criterios: CriterioNota[], notas: number[]): number {
  if (!criterios.length || criterios.length > 20 || criterios.length !== notas.length) throw new Error('Indica de 1 a 20 criterios y una nota por criterio');
  const pesos = criterios.map(c => Math.round(c.porcentaje * 100));
  if (criterios.some((c, i) => !c.nombre.trim() || c.nombre.length > 100 || !Number.isFinite(c.porcentaje) || c.porcentaje <= 0 || c.porcentaje > 100 || Math.abs(c.porcentaje * 100 - pesos[i]) > 1e-7) || pesos.reduce((s,p) => s+p,0) !== 10000) throw new Error('Los porcentajes deben sumar exactamente 100 y tener hasta dos decimales');
  if (notas.some(n => !Number.isFinite(n) || n < 0 || n > 10 || Math.abs(n * 100 - Math.round(n * 100)) > 1e-7)) throw new Error('Cada nota de criterio debe estar entre 0 y 10, con hasta dos decimales');
  return notas.reduce((s, n, i) => s + Math.round(n * 100) * pesos[i], 0) / 1e6;
}

export function resultadoMapa(mapa: Map<number, number>, clase: ClaseEvaluacion): number | null {
  return resultadoEvaluacion([...mapa].map(([parcial, calificacion]) => ({ parcial, calificacion, escalaMaxima: escalaDe(clase) })), clase);
}

/** Solo las Finales expresamente aprobadas o capturadas permiten cerrar Final. */
export function alumnosConFinalDisponible(notas:{alumnoId:number;parcial:number}[]):Set<number> {
  return new Set(notas.filter(n=>n.parcial===0).map(n=>n.alumnoId));
}

/** Una Final manual sustituye los parciales; no crea notas parciales ficticias. */
export function alumnosConParcialDisponible(notas:{alumnoId:number;parcial:number}[], parcial:number):Set<number> {
  return new Set(notas.filter(n=>n.parcial===parcial || n.parcial===0).map(n=>n.alumnoId));
}
