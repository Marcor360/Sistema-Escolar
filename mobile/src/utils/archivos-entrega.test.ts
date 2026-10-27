import { expect, it } from "vitest";
import { validarArchivoEntrega } from "./archivos-entrega";
it("admite formatos del contrato y nombres normales", () => {
  expect(
    validarArchivoEntrega({ name: "actividad.PDF", size: 1024 }),
  ).toBeNull();
  expect(validarArchivoEntrega({ name: "foto.jpeg" })).toBeNull();
});
it("rechaza formatos no previstos, vacío y archivos demasiado grandes", () => {
  expect(validarArchivoEntrega({ name: "virus.exe", size: 100 })).toContain(
    "Formato",
  );
  expect(validarArchivoEntrega({ name: "tarea.pdf", size: 0 })).toContain(
    "vacío",
  );
  expect(
    validarArchivoEntrega({ name: "tarea.pdf", size: 100 * 1024 * 1024 + 1 }),
  ).toContain("100 MB");
  expect(validarArchivoEntrega({ name: "a".repeat(201) + ".pdf" })).toContain(
    "200",
  );
  expect(validarArchivoEntrega({ name: "tarea.pdf", size: -1 })).toContain(
    "tamaño",
  );
  expect(
    validarArchivoEntrega({ name: "tarea.pdf", size: Number.NaN }),
  ).toContain("tamaño");
});

it("acepta solo URI local del selector, sin divulgar archivos por una URL remota", () => {
  expect(
    validarArchivoEntrega({
      name: "archivo.pdf",
      uri: "file:///data/cache/archivo.pdf",
    }),
  ).toBeNull();
  expect(
    validarArchivoEntrega({
      name: "archivo.pdf",
      uri: "content://proveedor/archivo",
    }),
  ).toBeNull();
  expect(
    validarArchivoEntrega({
      name: "archivo.pdf",
      uri: "https://tercero.invalid/doc.pdf",
    }),
  ).toContain("local");
  expect(
    validarArchivoEntrega({ name: "archivo.pdf", uri: "javascript:alert(1)" }),
  ).toContain("local");
  expect(
    validarArchivoEntrega({ name: "../privado.pdf", uri: "file:///cache/x" }),
  ).toContain("nombre");
});

it("rechaza URI vacía, remota, con credenciales o controles", () => {
  for (const uri of [
    "file://",
    "file://servidor/archivo.pdf",
    "content://proveedor",
    "content://usuario:clave@proveedor/archivo",
    "file:///cache/%00archivo.pdf",
    "file:///cache/x\n.pdf",
  ]) {
    expect(validarArchivoEntrega({ name: "archivo.pdf", uri })).toContain(
      "local",
    );
  }
});
it("conserva nombres Unicode y rechaza controles sin confundirlos con letras", () => {
  expect(
    validarArchivoEntrega({
      name: "tarea-unidad_1.pdf",
      uri: "file:///cache/tarea.pdf",
    }),
  ).toBeNull();
  expect(
    validarArchivoEntrega({
      name: "lectura-数学.pdf",
      uri: "content://proveedor/123",
    }),
  ).toBeNull();
  expect(validarArchivoEntrega({ name: "archivo\u007F.pdf" })).toContain(
    "nombre",
  );
  expect(validarArchivoEntrega({ name: "archivo\n.pdf" })).toContain("nombre");
});

it("acepta exactamente 100 MiB y los formatos académicos ampliados", () => {
  for (const ext of [
    "docx",
    "xlsx",
    "pptx",
    "odt",
    "ods",
    "odp",
    "rtf",
    "csv",
    "md",
    "webp",
    "gif",
    "bmp",
    "mp3",
    "wav",
    "mp4",
    "m4a",
  ]) {
    expect(
      validarArchivoEntrega({ name: `tarea.${ext}`, size: 100 * 1024 * 1024 }),
    ).toBeNull();
  }
});
