import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, expect, it, vi } from "vitest";
import { SeguimientoAlumno } from "./SeguimientoAlumno";
import { api } from "../api/client";
vi.mock("expo-crypto", () => ({
  randomUUID: () => "be678c57-bdd4-48ef-a461-4c43951f754c",
}));
vi.mock("../api/client", () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  mensajeDeError: () => "Error de conexión",
}));
vi.mock("./Texto", () => ({ Text: "Text" }));
vi.mock("../screens/comunes", () => ({ base: { botonAccesible: {} } }));
vi.mock("react-native", () => ({
  View: "View",
  Text: "Text",
  TextInput: "TextInput",
  TouchableOpacity: "TouchableOpacity",
  Alert: { alert: vi.fn() },
}));
let arbol: ReactTestRenderer | undefined;
afterEach(async () => {
  if (arbol) await act(async () => arbol?.unmount());
  arbol = undefined;
  vi.resetAllMocks();
});
it("carga seguimiento solo al abrirlo y consulta asistencias sin identificar otros alumnos", async () => {
  vi.mocked(api.get).mockImplementation(async (ruta) => ({
    data:
      ruta === "/asistencias"
        ? {
            datos: [
              {
                id: 1,
                fecha: "2026-10-26",
                estado: "PRESENTE",
                grupo: "A",
                materia: "Matemáticas",
              },
            ],
          }
        : [],
  }));
  await act(async () => {
    arbol = create(<SeguimientoAlumno />);
  });
  expect(api.get).not.toHaveBeenCalled();
  const botones = () => arbol!.root.findAllByType("TouchableOpacity" as never);
  await act(async () => {
    botones()[0].props.onPress();
  });
  const boton = botones().find((b) =>
    b
      .findAllByType("Text" as never)
      .some((t) => t.props.children === "Mis asistencias"),
  )!;
  await act(async () => {
    boton.props.onPress();
  });
  const llamada = vi
    .mocked(api.get)
    .mock.calls.find(([ruta]) => ruta === "/asistencias");
  expect(llamada?.[1]).toMatchObject({ params: { pagina: 1 } });
  expect(llamada?.[1]?.params).not.toHaveProperty("alumnoId");
  expect(JSON.stringify(arbol!.toJSON())).toContain("PRESENTE");
});
