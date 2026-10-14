export const LIMITE_INACTIVIDAD_MS = 30 * 60 * 1000;
export const CLAVE_ACTIVIDAD = 'escolar_ultima_actividad';
export const CLAVE_CIERRE = 'escolar_cierre_local';

export function inactividadVencida(ultima: number, ahora: number): boolean {
  return ahora - ultima >= LIMITE_INACTIVIDAD_MS;
}

export function leerUltimaActividad(): number | null {
  const valor = Number(localStorage.getItem(CLAVE_ACTIVIDAD));
  return Number.isFinite(valor) && valor > 0 && valor <= Date.now() ? valor : null;
}

export function guardarUltimaActividad(fecha: number): void {
  localStorage.setItem(CLAVE_ACTIVIDAD, String(fecha));
}

export function cierreLocalActivo(): boolean {
  return localStorage.getItem(CLAVE_CIERRE) !== null;
}

export function registrarCierreLocal(motivo: 'manual' | 'inactividad'): void {
  localStorage.setItem(CLAVE_CIERRE, motivo);
}

export function iniciarActividadAutenticada(): void {
  localStorage.removeItem(CLAVE_CIERRE);
  guardarUltimaActividad(Date.now());
}
