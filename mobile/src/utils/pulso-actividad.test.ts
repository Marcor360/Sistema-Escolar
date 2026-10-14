import { expect, it } from "vitest";
import { debeNotificarActividad } from "./pulso-actividad";

it("avisa la primera interacción", () => {
  expect(debeNotificarActividad(0, Date.now())).toBe(true);
});
it("bloquea pulsos repetidos durante 60 segundos", () => {
  expect(debeNotificarActividad(1000, 1000 + 59999)).toBe(false);
  expect(debeNotificarActividad(1000, 1000 + 60000)).toBe(true);
});
