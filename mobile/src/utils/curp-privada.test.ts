import { expect, it } from "vitest";
import { ocultarCurp } from "./curp-privada";

it("no muestra la CURP completa hasta que el alumno lo solicite", () => {
  const curp = "ABCD010203HDFXXX12";
  expect(ocultarCurp(curp)).toHaveLength(curp.length);
  expect(ocultarCurp(curp).endsWith("XX12")).toBe(true);
  expect(ocultarCurp(curp)).not.toContain("ABCD010203");
});
it("oculta por completo identificadores cortos", () => {
  expect(ocultarCurp("ABC")).toBe("••••");
});
