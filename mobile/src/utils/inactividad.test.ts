import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { crearControlInactividad, crearPersistenciaActividad, actividadRestaurable, LIMITE_INACTIVIDAD_MS } from "./inactividad";

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

it("un borrado lento del logout no elimina la actividad del login nuevo", async () => {
  let fecha: number | null = 100;
  let terminar!: () => void;
  const persistencia = crearPersistenciaActividad(
    async (valor) => { fecha = valor; },
    () => new Promise<void>((resolver) => { terminar = () => { fecha = null; resolver(); }; }),
  );
  const cierre = persistencia.borrar();
  const login = persistencia.guardar(200);
  await Promise.resolve(); await Promise.resolve();
  terminar(); await cierre; await login;
  expect(fecha).toBe(200);
});
it("un fallo de almacenamiento no bloquea la siguiente actividad", async () => {
  const guardar = vi.fn().mockRejectedValueOnce(new Error("almacenamiento")).mockResolvedValueOnce(undefined);
  const persistencia = crearPersistenciaActividad(guardar, async () => undefined);
  await persistencia.guardar(100); await persistencia.guardar(200);
  expect(guardar).toHaveBeenLastCalledWith(200);
});
it("rechaza marcas futuras, corruptas y vencidas al restaurar", () => {
  const ahora = LIMITE_INACTIVIDAD_MS + 1000;
  expect(actividadRestaurable(String(ahora + 1), ahora)).toBeNull();
  expect(actividadRestaurable("invalida", ahora)).toBeNull();
  expect(actividadRestaurable("1000", ahora)).toBeNull();
  expect(actividadRestaurable(String(ahora - 1), ahora)).toBe(ahora - 1);
  expect(actividadRestaurable(null, ahora)).toBe(ahora);
});
