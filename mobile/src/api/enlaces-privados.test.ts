import { describe, expect, it } from "vitest";
import { resolverEnlacePrivado } from "./enlaces-privados";

describe("Enlaces firmados del alumno", () => {
  it("acepta boleta y material autorizados del mismo origen", () => {
    expect(resolverEnlacePrivado("https://api.colegio.test", "/api/reportes/boleta-descarga/9?t=a.b_c-2", "boleta"))
      .toBe("https://api.colegio.test/api/reportes/boleta-descarga/9?t=a.b_c-2");
    expect(resolverEnlacePrivado("https://api.colegio.test", "/api/archivos/materiales/5?t=firmado", "material", 5))
      .toBe("https://api.colegio.test/api/archivos/materiales/5?t=firmado");
  });
  it.each([
    ["https://tercero.test/archivo", "boleta" as const],
    ["//tercero.test/archivo", "boleta" as const],
    ["/api/reportes/boleta-descarga/9", "boleta" as const],
    ["/api/reportes/boleta-descarga/9?t=firmado&otra=1", "boleta" as const],
    ["/api/archivos/biblioteca/2?t=firmado", "material" as const],
    ["/api/archivos/materiales/9?t=firmado", "material" as const],
    ["/api/archivos/materiales/%2e%2e/9?t=firmado", "material" as const],
  ])("rechaza enlace ajeno o manipulado: %s", (ruta, tipo) => {
    expect(() => resolverEnlacePrivado("https://api.colegio.test", ruta, tipo, 5)).toThrow("inválido");
  });
});
