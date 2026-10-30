import { describe, expect, it } from "vitest";
import { diaCalendarioEscolar, mesInicialCalendario, eventosDelDia } from "./calendario-escolar";

describe("Calendario del alumno en Expo y navegador", () => {
  it("usa día civil de Ciudad de México en lugar de UTC o del navegador", () => {
    expect(diaCalendarioEscolar("2026-11-01T02:00:00.000Z")).toBe("2026-10-31");
    expect(diaCalendarioEscolar("2026-11-01T13:00:00.000Z")).toBe("2026-11-01");
  });
  it("prioriza el mes vigente y usa el primero si el ciclo aún no inicia", () => {
    expect(mesInicialCalendario("2026-08-01", "2027-07-31", "2026-10-30")).toBe("2026-10");
    expect(mesInicialCalendario("2026-08-01", "2027-07-31", "2027-08-01")).toBe("2026-08");
  });
  it("incluye rangos multidiarios y excluye imágenes", () => {
    const eventos = [
      { id: 1, fechaInicio: "2026-10-20T12:00:00Z", fechaFin: "2026-10-22T23:59:59Z", imagenNombre: null },
      { id: 2, fechaInicio: "2026-10-21T12:00:00Z", fechaFin: null, imagenNombre: "calendario.webp" },
    ];
    expect(eventosDelDia(eventos, "2026-10-21").map((e) => e.id)).toEqual([1]);
    expect(eventosDelDia(eventos, "2026-10-23")).toEqual([]);
  });
});
