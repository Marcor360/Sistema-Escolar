/** Máximo un pulso autenticado por minuto y solo ante interacción del alumno. */
export function debeNotificarActividad(
  ultimoAviso: number,
  ahora: number,
): boolean {
  return ultimoAviso === 0 || ahora - ultimoAviso >= 60_000;
}
