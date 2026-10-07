/** Para el piloto: promedio oficial de P1-P3 completos, redondeado a un decimal. Final independiente. */
export const PARCIALES_OFICIALES = [1, 2, 3] as const;
export const DECIMALES_PROMEDIO = 1;
/** Expresión para agregación SQL de las mismas notas positivas P1-P3; alias interno fijo. */
export const PROMEDIO_OFICIAL_SQL = `ROUND(SUM(n.calificacion) / ${PARCIALES_OFICIALES.length}.0, ${DECIMALES_PROMEDIO})`;
export function promedioOficial(parciales: Map<number, number>): number | null {
  const valores = PARCIALES_OFICIALES.map((p) => parciales.get(p));
  if (valores.some((v) => v === undefined)) return null;
  return Math.round((valores.reduce<number>((s, v) => s + Number(v), 0) / PARCIALES_OFICIALES.length) * 10 ** DECIMALES_PROMEDIO) / 10 ** DECIMALES_PROMEDIO;
}
