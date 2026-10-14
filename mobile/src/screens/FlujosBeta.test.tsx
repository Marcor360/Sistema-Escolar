import Calificaciones from "./Calificaciones";
import React, { useEffect, type ReactElement, type ReactNode } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import Login from "./Login";
import CambioInicial from "./CambioPasswordInicial";
import Tareas from "./Tareas";
import EstadoCuenta from "./EstadoCuenta";
import Perfil from "./Perfil";
import { api } from "../api/client";
import { Alert, Linking, ScrollView, Text, TouchableOpacity } from "react-native";
import * as DocumentPicker from "expo-document-picker";
const sesion = vi.hoisted(() => ({
  sub: 1 as number | null,
  iniciar: vi.fn(),
  cerrar: vi.fn(),
  finalizarSesionLocal: vi.fn(),
}));
vi.mock("../sesion", () => ({
  useSesion: () => ({
    sesion: { sub: sesion.sub, nombre: "Alumno", email: "a@e.test" },
    ...sesion,
  }),
}));
vi.mock("../api/client", () => ({
  api: { get: vi.fn(), post: vi.fn() },
  archivosBase: "https://e.test",
  mensajeDeError: () => "No se pudo completar",
}));
vi.mock("../marca", () => ({
  useMarca: () => ({
    marca: {
      nombreInstitucion: "Escuela",
      nombreCorto: "E",
      logoUrl: null,
      colorPrimario: "#14343B",
      colorAcento: "#C79A3C",
    },
  }),
}));
vi.mock("../push", () => ({ activarPush: vi.fn(), desactivarPush: vi.fn() }));
vi.mock("expo-document-picker", () => ({ getDocumentAsync: vi.fn() }));
vi.mock("@react-navigation/native", () => ({
  useFocusEffect: (efecto: () => void | (() => void)) =>
    useEffect(efecto, [efecto]),
}));
vi.mock("../components/Texto", () => ({ Text: "Text" }));
vi.mock("react-native", async () => {
  const { createElement } = await import("react");
  return {
    View: "View",
    Text: "Text",
    Image: "Image",
    TextInput: "TextInput",
    ScrollView: "ScrollView",
    KeyboardAvoidingView: "KeyboardAvoidingView",
    TouchableOpacity: "TouchableOpacity",
    Pressable: "Pressable",
    ActivityIndicator: "ActivityIndicator",
    RefreshControl: "RefreshControl",
    Platform: { OS: "android" },
    Alert: { alert: vi.fn() },
    Linking: { openURL: vi.fn() },
    StyleSheet: { create: (s: unknown) => s },
    FlatList: ({
      data,
      renderItem,
      ListEmptyComponent,
      ListHeaderComponent,
    }: {
      data: unknown[];
      renderItem: (args: { item: unknown }) => ReactNode;
      ListEmptyComponent: ReactNode;
      ListHeaderComponent: ReactNode;
    }) =>
      createElement(
        "FlatList",
        null,
        ListHeaderComponent,
        data.length
          ? data.map((item, i) =>
              createElement(React.Fragment, { key: i }, renderItem({ item })),
            )
          : ListEmptyComponent,
      ),
  };
});
let vista: ReactTestRenderer;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.clearAllMocks();
  sesion.sub = 1;
  vi.mocked(api.get).mockResolvedValue({ data: [] });
  vi.mocked(api.post).mockResolvedValue({ data: {} });
  sesion.iniciar.mockResolvedValue(undefined);
  sesion.cerrar.mockResolvedValue(undefined);
  sesion.finalizarSesionLocal.mockResolvedValue(undefined);
});
afterEach(async () => {
  if (vista) await act(async () => vista.unmount());
  vi.unstubAllGlobals();
});
const montar = async (nodo: ReactElement) => {
  await act(async () => {
    vista = create(nodo);
  });
};
const escribir = async (label: string, value: string) => {
  await act(async () =>
    vista.root
      .findByProps({ accessibilityLabel: label })
      .props.onChangeText(value),
  );
};
const texto = () => JSON.stringify(vista.toJSON());
it("login bloquea doble toque incluso antes de renderizar el estado", async () => {
  let resolver!: () => void;
  sesion.iniciar.mockReturnValue(
    new Promise<void>((r) => {
      resolver = r;
    }),
  );
  await montar(<Login />);
  await escribir("Correo institucional", " a@e.test ");
  await escribir("Contraseña", "secreto");
  const boton = vista.root.findByProps({ accessibilityLabel: "Entrar" });
  let primera!: Promise<void>;
  await act(async () => {
    primera = boton.props.onPress();
    void boton.props.onPress();
  });
  expect(sesion.iniciar).toHaveBeenCalledOnce();
  expect(sesion.iniciar).toHaveBeenCalledWith("a@e.test", "secreto");
  await act(async () => {
    resolver();
    await primera;
  });
});
it("login oculta la contraseña inicialmente y permite verla sin cambiar el valor", async () => {
  await montar(<Login />);
  await escribir("Contraseña", "secreto");
  expect(
    vista.root.findByProps({ accessibilityLabel: "Contraseña" }).props
      .secureTextEntry,
  ).toBe(true);
  await act(async () =>
    vista.root
      .findByProps({ accessibilityLabel: "Mostrar contraseña" })
      .props.onPress(),
  );
  expect(
    vista.root.findByProps({ accessibilityLabel: "Contraseña" }).props
      .secureTextEntry,
  ).toBe(false);
  expect(
    vista.root.findByProps({ accessibilityLabel: "Contraseña" }).props.value,
  ).toBe("secreto");
});
it("cambio inicial no envía contraseñas distintas y permite corregir", async () => {
  const guardar = vi.fn().mockResolvedValue(undefined);
  await montar(<CambioInicial guardar={guardar} />);
  await escribir("Contraseña temporal", "temporal");
  await escribir("Nueva contraseña", "nuevaclave");
  await escribir("Confirmar nueva contraseña", "diferente");
  await act(async () =>
    vista.root
      .findByProps({
        accessibilityLabel: "Cambiar contraseña y volver a ingresar",
      })
      .props.onPress(),
  );
  expect(guardar).not.toHaveBeenCalled();
  expect(texto()).toContain("sin diferencias");
  await escribir("Confirmar nueva contraseña", "nuevaclave");
  await act(async () =>
    vista.root
      .findByProps({
        accessibilityLabel: "Cambiar contraseña y volver a ingresar",
      })
      .props.onPress(),
  );
  expect(guardar).toHaveBeenCalledWith("temporal", "nuevaclave");
});
it("reemplazar entrega requiere confirmación antes de abrir selector", async () => {
  vi.mocked(api.get).mockResolvedValue({
    data: [
      {
        id: 1,
        titulo: "Ensayo",
        tipo: "TAREA",
        parcial: 1,
        fechaEntrega: null,
        entrega: { estatus: "ENTREGADA", calificacion: null },
      },
    ],
  });
  await montar(<Tareas />);
  await act(async () =>
    vista.root
      .findByProps({ accessibilityLabel: "Reemplazar entrega: Ensayo" })
      .props.onPress(),
  );
  expect(DocumentPicker.getDocumentAsync).not.toHaveBeenCalled();
  expect(Alert.alert).toHaveBeenCalledWith(
    "Reemplazar entrega",
    expect.any(String),
    expect.any(Array),
  );
});
it("pago requiere confirmación antes de crear orden", async () => {
  vi.mocked(api.get).mockResolvedValue({
    data: {
      saldoTotal: 100,
      cargos: [
        {
          id: 1,
          descripcion: "Colegiatura",
          fechaVencimiento: null,
          estatus: "PENDIENTE",
          total: 100,
          pagado: 0,
          saldo: 100,
        },
      ],
      pagos: [],
    },
  });
  await montar(<EstadoCuenta />);
  const boton = vista.root.findAllByType(TouchableOpacity)[0];
  await act(async () => boton.props.onPress());
  expect(api.post).not.toHaveBeenCalled();
  expect(Alert.alert).toHaveBeenCalledWith(
    "Confirmar pago en línea",
    expect.any(String),
    expect.any(Array),
  );
});
it("perfil no cambia contraseña sin confirmación coincidente", async () => {
  await montar(<Perfil />);
  await escribir("Contraseña actual", "actual");
  await escribir("Nueva contraseña, mínimo 8 caracteres", "nuevaclave");
  const boton = vista.root.findByProps({ accessibilityLabel: "Actualizar contraseña" });
  await act(async () => boton.props.onPress());
  expect(api.post).not.toHaveBeenCalled();
  expect(Alert.alert).toHaveBeenCalledWith(
    "Revisa la contraseña",
    expect.stringContaining("coincidir"),
  );
});
it("cerrar sesión requiere confirmación", async () => {
  await montar(<Perfil />);
  const botones = vista.root.findAllByType(TouchableOpacity);
  await act(async () => botones[botones.length - 1].props.onPress());
  expect(sesion.cerrar).not.toHaveBeenCalled();
  expect(Alert.alert).toHaveBeenCalledWith(
    "Cerrar sesión",
    expect.any(String),
    expect.any(Array),
  );
});
it("confirmar reemplazo permite elegir archivo y cancelar no envía entrega", async () => {
  vi.mocked(api.get).mockResolvedValue({
    data: [
      {
        id: 1,
        titulo: "Ensayo",
        tipo: "TAREA",
        parcial: 1,
        fechaEntrega: null,
        entrega: { estatus: "ENTREGADA", calificacion: null },
      },
    ],
  });
  vi.mocked(DocumentPicker.getDocumentAsync).mockResolvedValue({
    canceled: true,
    assets: null,
  });
  await montar(<Tareas />);
  await act(async () =>
    vista.root
      .findByProps({ accessibilityLabel: "Reemplazar entrega: Ensayo" })
      .props.onPress(),
  );
  const botones = vi.mocked(Alert.alert).mock.calls.at(-1)?.[2];
  await act(async () =>
    botones?.find((b) => b.text === "Elegir nuevo archivo")?.onPress?.(),
  );
  expect(DocumentPicker.getDocumentAsync).toHaveBeenCalledOnce();
  expect(api.post).not.toHaveBeenCalled();
});
it("confirmar pago crea orden pero no abre enlace inseguro", async () => {
  vi.mocked(api.get).mockResolvedValue({
    data: {
      saldoTotal: 100,
      cargos: [
        {
          id: 1,
          descripcion: "Colegiatura",
          fechaVencimiento: null,
          estatus: "PENDIENTE",
          total: 100,
          pagado: 0,
          saldo: 100,
        },
      ],
      pagos: [],
    },
  });
  vi.mocked(api.post).mockResolvedValue({
    data: { urlPago: "http://inseguro.test/pago" },
  });
  await montar(<EstadoCuenta />);
  await act(async () =>
    vista.root.findAllByType(TouchableOpacity)[0].props.onPress(),
  );
  const botones = vi.mocked(Alert.alert).mock.calls.at(-1)?.[2];
  await act(async () =>
    botones?.find((b) => b.text === "Continuar")?.onPress?.(),
  );
  expect(api.post).toHaveBeenCalledWith("/finanzas/ordenes", { cargoId: 1 });
  expect(Alert.alert).toHaveBeenCalledWith(
    "Enlace de pago no seguro",
    expect.any(String),
  );
});
it("confirmar cierre evita envíos simultáneos", async () => {
  let resolver!: () => void;
  sesion.cerrar.mockReturnValue(
    new Promise<void>((r) => {
      resolver = r;
    }),
  );
  await montar(<Perfil />);
  const botones = vista.root.findAllByType(TouchableOpacity);
  await act(async () => botones[botones.length - 1].props.onPress());
  const confirmar = vi
    .mocked(Alert.alert)
    .mock.calls.at(-1)?.[2]
    ?.find((b) => b.text === "Cerrar sesión")?.onPress;
  await act(async () => {
    confirmar?.();
    confirmar?.();
  });
  expect(sesion.cerrar).toHaveBeenCalledOnce();
  await act(async () => resolver());
});
it("no envía archivo si el selector termina después de desmontar la pantalla", async () => {
  vi.mocked(api.get).mockResolvedValue({
    data: [
      {
        id: 1,
        titulo: "Ensayo",
        tipo: "TAREA",
        parcial: 1,
        fechaEntrega: null,
        entrega: null,
      },
    ],
  });
  let resolver!: (value: DocumentPicker.DocumentPickerResult) => void;
  vi.mocked(DocumentPicker.getDocumentAsync).mockReturnValue(
    new Promise((r) => {
      resolver = r;
    }),
  );
  await montar(<Tareas />);
  await act(async () =>
    vista.root
      .findByProps({ accessibilityLabel: "Entregar archivo: Ensayo" })
      .props.onPress(),
  );
  await act(async () => vista.unmount());
  await act(async () =>
    resolver({
      canceled: false,
      assets: [
        {
          uri: "file:///ensayo.pdf",
          lastModified: 0,
          name: "ensayo.pdf",
          mimeType: "application/pdf",
        },
      ],
    }),
  );
  expect(api.post).not.toHaveBeenCalled();
});
it("no abre enlace de pago que llega después de desmontar la pantalla", async () => {
  vi.mocked(api.get).mockResolvedValue({
    data: {
      saldoTotal: 100,
      cargos: [
        {
          id: 1,
          descripcion: "Colegiatura",
          fechaVencimiento: null,
          estatus: "PENDIENTE",
          total: 100,
          pagado: 0,
          saldo: 100,
        },
      ],
      pagos: [],
    },
  });
  let resolver!: (r: { data: { urlPago: string } }) => void;
  vi.mocked(api.post).mockReturnValue(
    new Promise((r) => {
      resolver = r;
    }),
  );
  await montar(<EstadoCuenta />);
  await act(async () =>
    vista.root.findAllByType(TouchableOpacity)[0].props.onPress(),
  );
  const confirmar = vi
    .mocked(Alert.alert)
    .mock.calls.at(-1)?.[2]
    ?.find((b) => b.text === "Continuar")?.onPress;
  await act(async () => confirmar?.());
  await act(async () => vista.unmount());
  await act(async () =>
    resolver({ data: { urlPago: "https://seguro.test/pago" } }),
  );
  expect(Linking.openURL).not.toHaveBeenCalled();
});

it('boleta móvil obtiene enlace propio y no abre una descarga si la pantalla se desmontó', async () => {
  let resolver!: (r: { data: { url: string } }) => void;
  vi.mocked(api.get).mockImplementation(async (ruta) => {
    if (ruta === '/reportes/mi-boleta/enlace') return new Promise((r) => { resolver = r; });
    return { data: [] };
  });
  await montar(<Calificaciones />);
  const boton = vista.root.findAllByType(TouchableOpacity)[0];
  let peticion!: Promise<void>;
  await act(async () => { peticion = boton.props.onPress(); });
  await act(async () => vista.unmount());
  await act(async () => { resolver({ data: { url: '/api/reportes/boleta-descarga/1?t=firmado' } }); await peticion; });
  expect(Linking.openURL).not.toHaveBeenCalled();
});
it('boleta móvil selecciona inscripción propia para distinguir traslados del mismo ciclo', async () => {
  vi.mocked(api.get).mockImplementation(async (ruta) => ({ data: ruta === '/reportes/mis-boletas' ? [{ inscripcionId: 9, cicloId: 2, ciclo: '2026', grupo: '1-A', plantel: 'Centro' }] : ruta === '/reportes/mi-boleta/enlace' ? { url: '/api/reportes/boleta-descarga/1?t=firmado' } : [] }));
  await montar(<Calificaciones />);
  await act(async () => vista.root.findByProps({ accessibilityLabel: 'Descargar boleta de 2026, 1-A' }).props.onPress());
  expect(api.get).toHaveBeenCalledWith('/reportes/mi-boleta/enlace', { params: { cicloId: 2, inscripcionId: 9 } });
  expect(Linking.openURL).toHaveBeenCalledWith('https://e.test/api/reportes/boleta-descarga/1?t=firmado');
});


it("calificaciones descarta notas y consultas pendientes al cambiar de identidad", async () => {
  const nota = (nombre: string) => ({ id: 1, parcial: 1, calificacion: 90, promedioOficial: null, grupoMateriaId: 1, grupoMateria: { materia: { clave: "MAT", nombre }, grupo: { nombre: "A", ciclo: { id: 1, nombre: "2026" } } } });
  vi.mocked(api.get).mockImplementation(async (ruta) => ({ data: ruta === "/calificaciones/mias" ? [nota("Alumno anterior")] : [] }));
  await montar(<Calificaciones />);
  expect(texto()).toContain("Alumno anterior");
  let resolver!: (r: { data: unknown[] }) => void;
  vi.mocked(api.get).mockImplementation(async (ruta) => ruta === "/calificaciones/mias" ? new Promise((r) => { resolver = r; }) : { data: [] });
  sesion.sub = 2;
  await act(async () => vista.update(<Calificaciones />));
  expect(texto()).not.toContain("Alumno anterior");
  sesion.sub = null;
  await act(async () => vista.update(<Calificaciones />));
  const llamadas = vi.mocked(api.get).mock.calls.length;
  await act(async () => resolver({ data: [nota("Respuesta obsoleta")] }));
  expect(texto()).not.toContain("Respuesta obsoleta");
  expect(api.get).toHaveBeenCalledTimes(llamadas);
});

it("bloquea nuevas órdenes cuando la consulta del saldo falla", async () => {
  const estado = {
    saldoTotal: 100,
    cargos: [{ id: 1, descripcion: "Colegiatura", fechaVencimiento: null, estatus: "PENDIENTE", total: 100, pagado: 0, saldo: 100 }],
    pagos: [],
  };
  vi.mocked(api.get).mockResolvedValue({ data: estado });
  await montar(<EstadoCuenta />);
  expect(vista.root.findAllByType(TouchableOpacity).length).toBeGreaterThan(0);
  vi.mocked(api.get).mockRejectedValueOnce(new Error("Sin conexión"));
  await act(async () => {
    vista.root.findByType(ScrollView).props.refreshControl.props.onRefresh();
  });
  expect(vista.root.findAllByType(Text).some((n) =>
    String(n.props.children).includes("saldos mostrados pueden estar desactualizados"))).toBe(true);
  const boton = vista.root.findAllByType(TouchableOpacity)[0];
  expect(boton.props.disabled).toBe(true);
  expect(api.post).not.toHaveBeenCalled();
});

it("revalida el importe antes de generar una orden y rechaza saldos modificados", async () => {
  const estado = {
    saldoTotal: 100,
    cargos: [{ id: 1, descripcion: "Colegiatura", fechaVencimiento: null, estatus: "PENDIENTE", total: 100, pagado: 0, saldo: 100 }],
    pagos: [],
  };
  vi.mocked(api.get).mockResolvedValue({ data: estado });
  await montar(<EstadoCuenta />);
  vi.mocked(api.get).mockResolvedValueOnce({ data: { ...estado, saldoTotal: 80, cargos: [{ ...estado.cargos[0], saldo: 80 }] } });
  const boton = vista.root.findAllByType(TouchableOpacity)[0];
  await act(async () => boton.props.onPress());
  const continuar = vi.mocked(Alert.alert).mock.calls.at(-1)?.[2]?.find((b) => b.text === "Continuar");
  await act(async () => continuar?.onPress?.());
  expect(api.post).not.toHaveBeenCalled();
  expect(Alert.alert).toHaveBeenCalledWith("El saldo cambió", expect.any(String));
});

it("tareas conserva datos solo como referencia y bloquea entregas con información obsoleta", async () => {
  const tarea = { id: 3, titulo: "Trabajo", tipo: "TAREA", parcial: 1, fechaEntrega: null, entrega: null };
  vi.mocked(api.get).mockResolvedValue({ data: [tarea] });
  await montar(<Tareas />);
  expect(vista.root.findByProps({ accessibilityLabel: "Entregar archivo: Trabajo" }).props.disabled).toBe(false);
  vi.mocked(api.get).mockRejectedValueOnce(new Error("Red interrumpida"));
  await act(async () =>
    vista.root.findByProps({ accessibilityLabel: "Actualizar tareas" }).props.onPress(),
  );
  expect(vista.root.findByProps({ accessibilityLabel: "Entregar archivo: Trabajo" }).props.disabled).toBe(true);
  expect(texto()).toContain("desactualizados");
  expect(DocumentPicker.getDocumentAsync).not.toHaveBeenCalled();

  vi.mocked(api.get).mockResolvedValueOnce({ data: [tarea] });
  await act(async () =>
    vista.root.findByProps({ accessibilityLabel: "Actualizar tareas" }).props.onPress(),
  );
  expect(vista.root.findByProps({ accessibilityLabel: "Entregar archivo: Trabajo" }).props.disabled).toBe(false);
});


it("bloquea el envío si la consulta vence mientras el selector está abierto", async () => {
  const tarea = { id: 3, titulo: "Trabajo", tipo: "TAREA", parcial: 1, fechaEntrega: null, entrega: null };
  vi.mocked(api.get).mockResolvedValue({ data: [tarea] });
  await montar(<Tareas />);
  let resolver!: (valor: Awaited<ReturnType<typeof DocumentPicker.getDocumentAsync>>) => void;
  vi.mocked(DocumentPicker.getDocumentAsync).mockReturnValueOnce(new Promise(r => { resolver = r; }));
  await act(async () => vista.root.findByProps({ accessibilityLabel: "Entregar archivo: Trabajo" }).props.onPress());
  const reloj = vi.spyOn(Date, "now").mockReturnValue(Date.now() + 5 * 60_000 + 1);
  try {
    await act(async () => resolver({ canceled: false, assets: [{ uri: "file:///trabajo.pdf", name: "trabajo.pdf", size: 10, lastModified: 0 }] }));
    expect(api.post).not.toHaveBeenCalled();
    expect(Alert.alert).toHaveBeenCalledWith("Actualiza tus tareas", expect.any(String));
  } finally { reloj.mockRestore(); }
});
