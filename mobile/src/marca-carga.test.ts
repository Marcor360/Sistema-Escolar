import { expect, it, vi } from "vitest";
import { cargarMarca, esMarcaValida } from "./marca-carga";
import type { Marca } from "./marca";
const marca: Marca = {
  nombreInstitucion: "Escuela",
  nombreCorto: "E",
  logoUrl: null,
  colorPrimario: "#14343B",
  colorPrimarioOscuro: "#0E262B",
  colorAcento: "#C79A3C",
  actualizadoEn: "",
};
const fuentes = () => ({
  leer: vi.fn().mockResolvedValue(null),
  eliminar: vi.fn().mockResolvedValue(undefined),
  guardar: vi.fn().mockResolvedValue(undefined),
  consultar: vi.fn().mockResolvedValue(marca),
});
it("almacén inaccesible no bloquea consultar marca pública", async () => {
  const f = fuentes();
  f.leer.mockRejectedValue(Error("SecureStore"));
  expect(await cargarMarca(f, marca, vi.fn())).toEqual(marca);
  expect(f.consultar).toHaveBeenCalledOnce();
});
it("caché corrupta y eliminación fallida terminan con marca predeterminada", async () => {
  const f = fuentes();
  f.leer.mockResolvedValue("{");
  f.eliminar.mockRejectedValue(Error("Store"));
  f.consultar.mockRejectedValue(Error("Red"));
  expect(await cargarMarca(f, marca, vi.fn())).toEqual(marca);
});
it("fallar al guardar no descarta la marca recibida", async () => {
  const f = fuentes();
  const nueva = { ...marca, nombreInstitucion: "Nueva" };
  f.consultar.mockResolvedValue(nueva);
  f.guardar.mockRejectedValue(Error("Sin espacio"));
  expect(await cargarMarca(f, marca, vi.fn())).toEqual(nueva);
});
it("respuesta inválida conserva caché válida", async () => {
  const f = fuentes();
  const cache = { ...marca, nombreInstitucion: "Caché" };
  f.leer.mockResolvedValue(JSON.stringify(cache));
  f.consultar.mockResolvedValue({});
  const recibir = vi.fn();
  expect(await cargarMarca(f, marca, recibir)).toEqual(cache);
  expect(recibir).toHaveBeenCalledWith(cache);
  expect(f.guardar).not.toHaveBeenCalled();
});
it.each([
  null,
  {},
  { ...marca, colorPrimario: "red" },
  { ...marca, logoUrl: "https://evil.test/x" },
  { ...marca, logoUrl: "/uploads/../x.png" },
])("rechaza marca malformada %j", (valor) =>
  expect(esMarcaValida(valor)).toBe(false),
);
it("acepta logo generado por backend", () =>
  expect(
    esMarcaValida({ ...marca, logoUrl: "/uploads/marca-logo-123abc.png" }),
  ).toBe(true));

it("detecta cambios de identidad y conserva la misma marca cuando no hay diferencias", async () => {
  const { mismaMarca } = await import("./marca-carga");
  const otra = { ...marca, logoUrl: "/uploads/marca-logo-123abc.webp" };
  expect(mismaMarca(marca, { ...marca })).toBe(true);
  expect(mismaMarca(marca, otra)).toBe(false);
  expect(mismaMarca(otra, { ...otra, colorPrimario: "#FFFFFF" })).toBe(false);
});
