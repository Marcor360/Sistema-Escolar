import { expect, it } from "vitest";
import { ETIQUETAS_NAVEGACION } from "./etiquetas-navegacion";

it("las seis pestañas incluyen nombres explícitos para lector de pantalla", () => {
  expect(Object.keys(ETIQUETAS_NAVEGACION)).toHaveLength(6);
  for (const nombre of Object.values(ETIQUETAS_NAVEGACION)) {
    expect(nombre.length).toBeGreaterThan(9);
  }
  expect(ETIQUETAS_NAVEGACION.Pagos).toContain("estado de cuenta");
});
