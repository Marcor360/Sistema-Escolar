import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import {
  CLAVE_CIERRE, cierreLocalActivo, guardarUltimaActividad, inactividadVencida,
  iniciarActividadAutenticada, leerUltimaActividad, LIMITE_INACTIVIDAD_MS,
  registrarCierreLocal,
} from './inactividad';

beforeEach(() => { localStorage.clear(); vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-14T12:00:00Z')); });
afterEach(() => { localStorage.clear(); vi.useRealTimers(); });

it('vence exactamente a los 30 minutos desde el último movimiento', () => {
  expect(inactividadVencida(1000, 1000 + LIMITE_INACTIVIDAD_MS - 1)).toBe(false);
  expect(inactividadVencida(1000, 1000 + LIMITE_INACTIVIDAD_MS)).toBe(true);
});
it('la actividad es compartida sin guardar credenciales y el cierre persiste al recargar', () => {
  guardarUltimaActividad(Date.now() - 1000);
  expect(leerUltimaActividad()).toBe(Date.now() - 1000);
  registrarCierreLocal('inactividad');
  expect(localStorage.getItem(CLAVE_CIERRE)).toBe('inactividad');
  expect(cierreLocalActivo()).toBe(true);
  iniciarActividadAutenticada();
  expect(cierreLocalActivo()).toBe(false);
  expect(leerUltimaActividad()).toBe(Date.now());
});
