/** Conserva P1, P2 y P3 antes de Final (periodo 0), sin alterar el arreglo fuente. */
export function ordenarPeriodos<T extends { parcial: number }>(registros: readonly T[]): T[] {
  return [...registros].sort((a, b) => (a.parcial === 0 ? 4 : a.parcial) - (b.parcial === 0 ? 4 : b.parcial));
}
