/** Para el piloto: promedio oficial de P1-P3 completos, redondeado a un decimal. Final independiente. */
export function promedioOficial(parciales: Map<number, number>): number | null {
  const valores = [1, 2, 3].map((p) => parciales.get(p));
  if (valores.some((v) => v === undefined)) return null;
  return Math.round((valores.reduce<number>((s, v) => s + Number(v), 0) / 3) * 10) / 10;
}
