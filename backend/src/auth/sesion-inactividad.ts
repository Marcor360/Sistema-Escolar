/** La API solo amplía esta ventana cuando recibe una actividad explícita y autenticada. */
export const LIMITE_INACTIVIDAD_MS = 30 * 60 * 1000;

export function sesionInactiva(ultima: Date | null | undefined, ahora: Date): boolean {
  return !ultima || !Number.isFinite(ultima.getTime()) ||
    ultima.getTime() > ahora.getTime() ||
    ultima.getTime() <= ahora.getTime() - LIMITE_INACTIVIDAD_MS;
}

/** DATETIME MySQL sin fracciones redondea; guardar segundos completos evita marcas futuras. */
export function instanteActividad(ahora: number = Date.now()): Date {
  return new Date(Math.floor(ahora / 1000) * 1000);
}
