import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { crearControlInactividad, LIMITE_INACTIVIDAD_MS } from "./inactividad";

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(0); });
afterEach(() => vi.useRealTimers());
it("cierra a los 30 minutos exactos si no hay interacción", () => {
  const salir = vi.fn();
  const control = crearControlInactividad(salir);
  vi.advanceTimersByTime(LIMITE_INACTIVIDAD_MS - 1);
  expect(salir).not.toHaveBeenCalled();
  vi.advanceTimersByTime(1);
  expect(salir).toHaveBeenCalledOnce();
  control.detener();
});
it("la actividad reinicia el plazo y la verificación tras suspensión detecta vencimiento", () => {
  const salir = vi.fn();
  const control = crearControlInactividad(salir);
  vi.advanceTimersByTime(15 * 60_000);
  control.actividad();
  vi.advanceTimersByTime(29 * 60_000);
  expect(salir).not.toHaveBeenCalled();
  vi.setSystemTime(LIMITE_INACTIVIDAD_MS + 15 * 60_000);
  control.comprobar();
  expect(salir).toHaveBeenCalledOnce();
  control.actividad();
  expect(salir).toHaveBeenCalledOnce();
});
it("desmontar el control no cierra la nueva sesión", () => {
  const salir = vi.fn();
  const control = crearControlInactividad(salir);
  control.detener();
  vi.advanceTimersByTime(LIMITE_INACTIVIDAD_MS * 2);
  expect(salir).not.toHaveBeenCalled();
});
