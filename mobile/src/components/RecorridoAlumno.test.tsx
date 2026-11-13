import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, expect, it, vi } from "vitest";
import * as SecureStore from "expo-secure-store";
import { RecorridoAlumno } from "./RecorridoAlumno";
import { repetirRecorridoAlumno } from "../recorrido-alumno";
import { api } from "../api/client";
vi.mock("../api/client", () => ({ api: { get: vi.fn().mockResolvedValue({ data: { accesoPrevio: false } }) } }));
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
  expect(navegar).toHaveBeenCalledWith("Calendario");
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

it("no abre automáticamente si ya ingresó por otro portal y permite repetir", async () => {
  vi.mocked(SecureStore.getItemAsync).mockResolvedValue(null);
  vi.mocked(api.get).mockResolvedValueOnce({ data: { accesoPrevio: true } });
  await act(async () => { arbol = create(<RecorridoAlumno usuarioId={3} navegar={vi.fn()} />); });
  expect(arbol!.toJSON()).toBeNull();
  await act(async () => repetirRecorridoAlumno());
  expect(arbol!.toJSON()).not.toBeNull();
});

it('permite elegir una tarea y abre directamente su pantalla de entregas', async () => {
  vi.mocked(SecureStore.getItemAsync).mockResolvedValue("1");
  const navegar = vi.fn();
  await act(async () => { arbol = create(<RecorridoAlumno usuarioId={4} navegar={navegar} />); });
  await act(async () => repetirRecorridoAlumno());
  const pulsar = async (texto: string) => { await act(async () => arbol!.root.findAllByType("TouchableOpacity" as never)
    .find(b => b.findAllByType("Text" as never).some(t => t.props.children === texto))!.props.onPress()); };
  await pulsar('Ver todos los pasos');
  await act(async () => arbol!.root.findByProps({ accessibilityLabel: 'Ir al paso 4: Entregar una actividad' }).props.onPress());
  await pulsar('Ver esta pantalla');
  expect(navegar).toHaveBeenCalledWith('Materias', expect.objectContaining({ subpantalla: 'MisTareas' }));
  expect(JSON.stringify(arbol!.toJSON())).toContain('Continuar guía');
});
