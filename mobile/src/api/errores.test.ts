import { describe, expect, it } from "vitest";
import { mensajeDeError } from "./errores";

describe("mensajeDeError móvil", () => {
  it("distingue desconexión y timeout", () => {
    expect(mensajeDeError({})).toContain("No se pudo conectar");
    expect(mensajeDeError({ code: "ECONNABORTED" })).toContain(
      "tardó demasiado",
    );
  });

  it("presenta fallos del servidor y validación", () => {
    expect(mensajeDeError({ response: { status: 503 } })).toContain(
      "fuera de línea",
    );
    expect(
      mensajeDeError({
        response: { data: { message: ["Dato inválido", "Revisa el formato"] } },
      }),
    ).toBe("Dato inválido, Revisa el formato");
  });
});
it("oculta detalles internos y tolera null", () => {
  expect(
    mensajeDeError({
      response: { status: 500, data: { message: "SQL passwordHash stack" } },
    }),
  ).not.toContain("passwordHash");
  expect(mensajeDeError(null)).toContain("No se pudo conectar");
});
