import React, { useEffect, type ReactNode } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { Linking } from "react-native";
import { api } from "../api/client";
import DocumentosScreen from "./Documentos";
import { configurarCacheAcademica } from "../api/cache-academica";

const contexto = vi.hoisted(() => ({ sesion: { sub: 1 } as { sub: number } | null }));
vi.mock("../sesion", () => ({ useSesion: () => ({ sesion: contexto.sesion }) }));
vi.mock("../api/client", () => ({
  api: { get: vi.fn() },
  archivosBase: "https://api.escuela.test",
  mensajeDeError: (error: unknown) => error instanceof Error ? error.message : "Sin conexión",
}));
vi.mock("@react-navigation/native", () => ({
  useFocusEffect: (efecto: () => void | (() => void)) => useEffect(efecto, [efecto]),
}));
vi.mock("../components/Texto", () => ({ Text: "Text" }));
vi.mock("react-native", async () => {
  const { createElement } = await import("react");
  return {
  View: "View", Text: "Text", Pressable: "Pressable",
  ScrollView: ({ children }: { children: ReactNode }) => createElement("ScrollView", null, children),
  TouchableOpacity: "TouchableOpacity", ActivityIndicator: "ActivityIndicator",
  RefreshControl: "RefreshControl", Linking: { openURL: vi.fn() },
  StyleSheet: { create: (styles: unknown) => styles },
};
});
const boleta = { inscripcionId: 3, cicloId: 2, ciclo: "2026", grupo: "1-A", plantel: "Centro" };
const materia = { id: 7, materia: { clave: "MAT", nombre: "Matemáticas" },
  grupo: { nombre: "1-A", ciclo: { clave: "2026" } } };
const archivo = { id: 20, titulo: "Lectura", archivoNombre: "lectura.pdf", tamanoKb: 24 };
let vista: ReactTestRenderer;
const textos = () => JSON.stringify(vista.toJSON());
const pulsar = async (etiqueta: string) => {
  await act(async () => vista.root.findByProps({ accessibilityLabel: etiqueta }).props.onPress());
};
const montar = async () => {
  await act(async () => { vista = create(<DocumentosScreen />); });
};
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  contexto.sesion = { sub: 1 };
  configurarCacheAcademica(1);
  vi.mocked(Linking.openURL).mockReset();
  vi.mocked(api.get).mockReset().mockImplementation(async (ruta) => ({
    data: ruta === "/reportes/mis-boletas" ? [boleta]
      : ruta === "/alumnos/me/materias" ? [materia]
      : ruta === "/grupo-materias/7/materiales" ? [archivo] : [],
  }));
});
afterEach(async () => {
  if (vista) await act(async () => vista.unmount());
  configurarCacheAcademica(null);
  vi.unstubAllGlobals();
});
it("agrupa boletas por ciclo y documentos por carpeta de materia", async () => {
  await montar();
  expect(textos()).toContain("Boletas por ciclo escolar");
  expect(textos()).toContain("Materiales de mis materias");
  await pulsar("Abrir carpeta Matemáticas");
  expect(textos()).toContain("lectura.pdf");
  expect(api.get).toHaveBeenCalledWith("/grupo-materias/7/materiales");
  expect(textos()).not.toContain("biblioteca");
});
it("abre únicamente boleta y material con enlace firmado de la API", async () => {
  await montar();
  vi.mocked(api.get).mockResolvedValueOnce({ data: { url: "/api/reportes/boleta-descarga/4?t=firmado" } });
  await pulsar("Abrir boleta PDF de 2026, 1-A");
  expect(api.get).toHaveBeenCalledWith("/reportes/mi-boleta/enlace",
    { params: { cicloId: 2, inscripcionId: 3 } });
  expect(Linking.openURL).toHaveBeenCalledWith("https://api.escuela.test/api/reportes/boleta-descarga/4?t=firmado");
  await pulsar("Abrir carpeta Matemáticas");
  vi.mocked(api.get).mockResolvedValueOnce({ data: { url: "/api/archivos/materiales/20?t=firmado" } });
  await pulsar("Abrir Lectura");
  expect(Linking.openURL).toHaveBeenCalledWith("https://api.escuela.test/api/archivos/materiales/20?t=firmado");
});
it("rechaza el enlace de descarga apuntando a un tercero", async () => {
  await montar();
  vi.mocked(api.get).mockResolvedValueOnce({ data: { url: "https://tercero.test/boleta" } });
  await pulsar("Abrir boleta PDF de 2026, 1-A");
  expect(Linking.openURL).not.toHaveBeenCalled();
  expect(textos()).toContain("inválido");
});
it("al cambiar de alumno elimina carpetas visibles y no publica respuesta anterior", async () => {
  await montar();
  await pulsar("Abrir carpeta Matemáticas");
  expect(textos()).toContain("lectura.pdf");
  let resolver!: (r: { data: unknown }) => void;
  vi.mocked(api.get).mockImplementation((ruta) => ruta === "/reportes/mis-boletas"
    ? new Promise((r) => { resolver = r; })
    : Promise.resolve({ data: [] }));
  contexto.sesion = { sub: 2 };
  configurarCacheAcademica(2);
  await act(async () => { vista.update(<DocumentosScreen />); });
  expect(textos()).not.toContain("lectura.pdf");
  await act(async () => { resolver({ data: [boleta] }); });
  expect(textos()).not.toContain("Boleta · 2026");
});
