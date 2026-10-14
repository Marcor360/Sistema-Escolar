import { expect, it } from "vitest";
import { fechaHoraEscolar } from "./fecha-evento";
it("el evento conserva el día y la hora escolar aunque el instante esté en UTC", () => {
  const texto = fechaHoraEscolar("2026-10-15T02:00:00Z");
  expect(texto).toMatch(/14/);
  expect(texto).toMatch(/20:00|8:00/);
});
