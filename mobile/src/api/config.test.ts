import { describe, expect, it } from "vitest";
import { resolverApiUrl } from "./config";

describe("URL de API móvil", () => {
  it("permite localhost solo en desarrollo", () => {
    expect(resolverApiUrl("development")).toBe("http://localhost:3000/api");
    expect(() =>
      resolverApiUrl("production", "http://localhost:3000/api"),
    ).toThrow("HTTPS");
  });

  it("exige una URL HTTPS en preview y producción", () => {
    expect(() => resolverApiUrl("preview")).toThrow("Falta");
    expect(() =>
      resolverApiUrl("production", "http://escuela.example/api"),
    ).toThrow("HTTPS");
    expect(
      resolverApiUrl("production", "https://api.escuela.example/api"),
    ).toBe("https://api.escuela.example/api");
  });
});
it("normaliza espacios y slash final para que API y enlaces de archivo compartan la base", () => {
  expect(resolverApiUrl("preview", " https://api.example.invalid/api/ ")).toBe(
    "https://api.example.invalid/api",
  );
  expect(resolverApiUrl("development", "http://localhost:3000/api/")).toBe(
    "http://localhost:3000/api",
  );
});
it.each([
  "https://user:secret@escuela.test/api",
  "https://escuela.test/api?token=x",
  "https://escuela.test/api#x",
  "https://escuela.test",
  "https://escuela.test/api/v2",
])("rechaza URL que rompe rutas o filtra credenciales %s", (url) =>
  expect(() => resolverApiUrl("preview", url)).toThrow(),
);
it("rechaza esquemas y entornos desconocidos", () => {
  expect(() => resolverApiUrl("development", "file:///api")).toThrow();
  expect(() => resolverApiUrl("prod", "https://escuela.test/api")).toThrow();
});
