import { expect, it } from "vitest";
import { calcularDisenoAlumno } from "./diseno-alumno";
it("mantiene los accesos dentro del ancho útil en teléfonos, orientación horizontal y tabletas", () => {
  for (const ancho of [280, 320, 360, 390, 430, 568, 683.5, 737.142, 768, 1024, 1366])
    for (const fuente of [1, 1.3, 1.5, 2, 3]) {
      const d = calcularDisenoAlumno(ancho, fuente);
      expect(d.anchoContenido).toBeLessThanOrEqual(ancho);
      expect(d.anchoContenido).toBeLessThanOrEqual(900);
      expect(
        d.anchoAcceso * d.columnas + 12 * (d.columnas - 1) + d.lateral * 2,
      ).toBeLessThanOrEqual(d.anchoContenido + 0.001);
      expect(d.anchoAcceso).toBeGreaterThan(0);
      if (ancho < 680 || fuente > 1.3) expect(d.columnas).toBe(1);
    }
});
it("aprovecha tabletas con dos columnas y vuelve a una con texto ampliado", () => {
  expect(calcularDisenoAlumno(768, 1).columnas).toBe(2);
  expect(calcularDisenoAlumno(768, 2).columnas).toBe(1);
  expect(calcularDisenoAlumno(1024).anchoContenido).toBe(900);
});
