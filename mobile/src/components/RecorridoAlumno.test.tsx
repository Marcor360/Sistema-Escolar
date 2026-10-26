import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, expect, it, vi } from "vitest";
import * as SecureStore from "expo-secure-store";
import { RecorridoAlumno } from "./RecorridoAlumno";
import { repetirRecorridoAlumno } from "../recorrido-alumno";
vi.mock("expo-secure-store", () => ({
  getItemAsync: vi.fn(),
  setItemAsync: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("react-native", () => ({
  Modal: "Modal",
  ScrollView: "ScrollView",
  TouchableOpacity: "TouchableOpacity",
  View: "View",
}));
vi.mock("./Texto", () => ({ Text: "Text" }));
vi.mock("../marca", () => ({
  useMarca: () => ({ marca: { colorPrimario: "#14343b" } }),
}));
let arbol: ReactTestRenderer | undefined;
afterEach(async () => {
  if (arbol) await act(async () => arbol?.unmount());
  vi.clearAllMocks();
});
it("guía al alumno sin guardar tareas y permite pausar en una pantalla real", async () => {
  vi.mocked(SecureStore.getItemAsync).mockResolvedValue(null);
  const navegar = vi.fn();
  await act(async () => {
    arbol = create(<RecorridoAlumno usuarioId={1} navegar={navegar} />);
  });
  expect(JSON.stringify(arbol!.toJSON())).toContain("Tu inicio");
  const boton = (texto: string) =>
    arbol!.root
      .findAllByType("TouchableOpacity" as never)
      .find((b) =>
        b
          .findAllByType("Text" as never)
          .some((t) => t.props.children === texto),
      )!;
  await act(async () => boton("Siguiente").props.onPress());
  expect(JSON.stringify(arbol!.toJSON())).toContain("Calendario y asistencias");
  await act(async () => boton("Ver esta pantalla").props.onPress());
  expect(navegar).toHaveBeenCalledWith("Inicio");
  expect(JSON.stringify(arbol!.toJSON())).toContain("Continuar guía");
  await act(async () => repetirRecorridoAlumno());
  await act(async () => boton("Omitir recorrido").props.onPress());
  expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
    "iua_guia_alumno_v1_1",
    "1",
  );
});
it("respeta la preferencia propia y permite repetir desde Perfil", async () => {
  vi.mocked(SecureStore.getItemAsync).mockResolvedValue("1");
  await act(async () => {
    arbol = create(<RecorridoAlumno usuarioId={2} navegar={vi.fn()} />);
  });
  expect(arbol!.toJSON()).toBeNull();
  await act(async () => repetirRecorridoAlumno());
  expect(arbol!.toJSON()).not.toBeNull();
});
