/** P1–P4 antes de Final (0), sin modificar los registros originales. */
export function ordenarPeriodos<T extends { parcial: number }>(registros: readonly T[]): T[] {
  return [...registros].sort((a, b) => (a.parcial === 0 ? 5 : a.parcial) - (b.parcial === 0 ? 5 : b.parcial));
}
