import { expect, it } from "vitest";
import { validarArchivoEntrega } from "./archivos-entrega";
it("admite formatos del contrato y nombres normales", () => {
  expect(validarArchivoEntrega({ name: "actividad.PDF", size: 1024 })).toBeNull();
  expect(validarArchivoEntrega({ name: "foto.jpeg" })).toBeNull();
});
it("rechaza formatos no previstos, vacío y archivos demasiado grandes", () => {
  expect(validarArchivoEntrega({ name: "virus.exe", size: 100 })).toContain("Formato");
  expect(validarArchivoEntrega({ name: "tarea.pdf", size: 0 })).toContain("vacío");
  expect(validarArchivoEntrega({ name: "tarea.pdf", size: 5 * 1024 * 1024 + 1 })).toContain("5 MB");
  expect(validarArchivoEntrega({ name: "a".repeat(201) + ".pdf" })).toContain("200");
  expect(validarArchivoEntrega({ name: "tarea.pdf", size: -1 })).toContain("tamaño");
  expect(validarArchivoEntrega({ name: "tarea.pdf", size: Number.NaN })).toContain("tamaño");
});

it("acepta solo URI local del selector, sin divulgar archivos por una URL remota", () => {
  expect(validarArchivoEntrega({ name: "archivo.pdf", uri: "file:///data/cache/archivo.pdf" })).toBeNull();
  expect(validarArchivoEntrega({ name: "archivo.pdf", uri: "content://proveedor/archivo" })).toBeNull();
  expect(validarArchivoEntrega({ name: "archivo.pdf", uri: "https://tercero.invalid/doc.pdf" })).toContain("local");
  expect(validarArchivoEntrega({ name: "archivo.pdf", uri: "javascript:alert(1)" })).toContain("local");
  expect(validarArchivoEntrega({ name: "../privado.pdf", uri: "file:///cache/x" })).toContain("nombre");
});
