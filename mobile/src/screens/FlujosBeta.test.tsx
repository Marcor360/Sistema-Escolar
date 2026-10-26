vi.mock("react-native-safe-area-context",()=>({useSafeAreaInsets:()=>({top:0,bottom:0,left:0,right:0})}));
import { PendientesAlumno } from "../components/PendientesAlumno";
vi.mock('expo-crypto',()=>({randomUUID:()=> 'be678c57-bdd4-48ef-a461-4c43951f754c'}));
import { configurarCacheAcademica } from '../api/cache-academica';
import Inicio from "./Inicio";
import ActivarCuenta from "./ActivarCuenta";
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
import { Alert, AppState, Linking, ScrollView, Text, TouchableOpacity } from "react-native";
import * as SecureStore from "expo-secure-store";
import * as DocumentPicker from "expo-document-picker";
const sesion = vi.hoisted(() => ({
  sub: 1 as number | null,
  navegar: vi.fn(),
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
vi.mock("expo-secure-store", () => ({ getItemAsync: vi.fn(async () => null), setItemAsync: vi.fn(async () => undefined), deleteItemAsync: vi.fn(async () => undefined), canUseBiometricAuthentication: vi.fn(() => false) }));
vi.mock("expo-document-picker", () => ({ getDocumentAsync: vi.fn() }));
vi.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ navigate: sesion.navegar }),
  useFocusEffect: (efecto: () => void | (() => void)) =>
    useEffect(efecto, [efecto]),
}));
vi.mock("../components/Texto", () => ({ Text: "Text" }));
vi.mock("react-native", async () => {
  const { createElement } = await import("react");
  return {
    useWindowDimensions: () => ({width:390,height:844,fontScale:1,scale:1}),
    View: "View",
    Text: "Text",
    Image: "Image",
    TextInput: "TextInput",
    ScrollView: "ScrollView",
    KeyboardAvoidingView: "KeyboardAvoidingView",
    TouchableOpacity: "TouchableOpacity",
    Pressable: "Pressable",
    ActivityIndicator: "ActivityIndicator",
    AppState: { addEventListener: vi.fn(() => ({ remove: vi.fn() })) },
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
  vi.mocked(api.get).mockImplementation(async ruta=>({data:ruta==='/calificaciones/mias/listado'?{datos:[],total:0}:[]}));
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
    data: {datos: [
      {
        id: 1,
        titulo: "Ensayo",
        tipo: "TAREA",
        parcial: 1,
        fechaEntrega: null,
        entrega: { estatus: "ENTREGADA", calificacion: null },
      },
    ], total:1},
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
    data: {datos: [
      {
        id: 1,
        titulo: "Ensayo",
        tipo: "TAREA",
        parcial: 1,
        fechaEntrega: null,
        entrega: { estatus: "ENTREGADA", calificacion: null },
      },
    ], total:1},
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
    data: {datos: [
      {
        id: 1,
        titulo: "Ensayo",
        tipo: "TAREA",
        parcial: 1,
        fechaEntrega: null,
        entrega: null,
      },
    ], total:1},
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
    return { data: ruta==='/calificaciones/mias/listado'?{datos:[],total:0}:[] };
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
  vi.mocked(api.get).mockImplementation(async (ruta) => ({ data: ruta === '/reportes/mis-boletas' ? [{ inscripcionId: 9, cicloId: 2, ciclo: '2026', grupo: '1-A', plantel: 'Centro' }] : ruta === '/reportes/mi-boleta/enlace' ? { url: '/api/reportes/boleta-descarga/1?t=firmado' } : ruta === '/reportes/formatos/mi-boleta' ? {disponible:true,institucion:'Escuela',alumno:'QA',matricula:'QA1',filas:[],promedioGeneral:80,aviso:''} : ruta==='/calificaciones/mias/listado'?{datos:[],total:0}:[] }));
  await montar(<Calificaciones />);
  await act(async () => vista.root.findByProps({ accessibilityLabel: 'Ver boleta de 2026, 1-A' }).props.onPress());
  expect(api.get).toHaveBeenCalledWith('/reportes/formatos/mi-boleta', expect.objectContaining({ params: { inscripcionId: 9 } }));
  await act(async () => vista.root.findByProps({ accessibilityLabel: 'Descargar mi boleta Excel' }).props.onPress());
  expect(api.get).toHaveBeenCalledWith('/reportes/mi-boleta/enlace', { params: { inscripcionId: 9, formato:'informativa-excel' } });
  expect(Linking.openURL).toHaveBeenCalledWith('https://e.test/api/reportes/boleta-descarga/1?t=firmado');
});



it("calificaciones descarta notas y consultas pendientes al cambiar de identidad", async () => {
  const nota = (nombre: string) => ({ id: 1, parcial: 1, calificacion: 90, promedioOficial: null, grupoMateriaId: 1, grupoMateria: { materia: { clave: "MAT", nombre }, grupo: { nombre: "A", ciclo: { id: 1, nombre: "2026" } } } });
  vi.mocked(api.get).mockImplementation(async (ruta) => ({ data: ruta === "/calificaciones/mias/listado" ? {datos:[nota("Alumno anterior")],total:1} : [] }));
  await montar(<Calificaciones />);
  expect(texto()).toContain("Alumno anterior");
  let resolver!: (r: { data: {datos:unknown[];total:number} }) => void;
  vi.mocked(api.get).mockImplementation(async (ruta) => ruta === "/calificaciones/mias/listado" ? new Promise((r) => { resolver = r; }) : { data: [] });
  sesion.sub = 2;
  await act(async () => vista.update(<Calificaciones />));
  expect(texto()).not.toContain("Alumno anterior");
  sesion.sub = null;
  await act(async () => vista.update(<Calificaciones />));
  const llamadas = vi.mocked(api.get).mock.calls.length;
  await act(async () => resolver({ data: {datos:[nota("Respuesta obsoleta")],total:1} }));
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
  vi.mocked(api.get).mockResolvedValue({ data: {datos:[tarea],total:1} });
  await montar(<Tareas />);
  expect(vista.root.findByProps({ accessibilityLabel: "Entregar archivo: Trabajo" }).props.disabled).toBe(false);
  vi.mocked(api.get).mockRejectedValueOnce(new Error("Red interrumpida"));
  await act(async () =>
    vista.root.findByProps({ accessibilityLabel: "Actualizar tareas" }).props.onPress(),
  );
  expect(vista.root.findByProps({ accessibilityLabel: "Entregar archivo: Trabajo" }).props.disabled).toBe(true);
  expect(texto()).toContain("desactualizados");
  expect(DocumentPicker.getDocumentAsync).not.toHaveBeenCalled();

  vi.mocked(api.get).mockResolvedValueOnce({ data: {datos:[tarea],total:1} });
  await act(async () =>
    vista.root.findByProps({ accessibilityLabel: "Actualizar tareas" }).props.onPress(),
  );
  expect(vista.root.findByProps({ accessibilityLabel: "Entregar archivo: Trabajo" }).props.disabled).toBe(false);
});


it("bloquea el envío si la consulta vence mientras el selector está abierto", async () => {
  const tarea = { id: 3, titulo: "Trabajo", tipo: "TAREA", parcial: 1, fechaEntrega: null, entrega: null };
  vi.mocked(api.get).mockResolvedValue({ data: {datos:[tarea],total:1} });
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

it("rechaza crear una copia temporal del adjunto cuando el preflight online falla", async () => {
  const tarea = { id: 8, titulo: "Informe", tipo: "TAREA", parcial: 1, fechaEntrega: null, entrega: null };
  vi.mocked(api.get).mockResolvedValueOnce({ data: {datos:[tarea],total:1} }).mockRejectedValueOnce(new Error("Sin red"));
  await montar(<Tareas />);
  await act(async () => vista.root.findByProps({ accessibilityLabel: "Entregar archivo: Informe" }).props.onPress());
  expect(DocumentPicker.getDocumentAsync).not.toHaveBeenCalled();
  expect(api.post).not.toHaveBeenCalled();
  expect(Alert.alert).toHaveBeenCalledWith("No se pudo entregar", expect.any(String));
});


it("activa una cuenta de alumno, impide duplicados y limpia los secretos al terminar", async () => {
  vi.mocked(api.post).mockResolvedValueOnce({ data: { mensaje: "Solicitud recibida; revisa tu correo si está disponible" } });
  await montar(<ActivarCuenta volver={vi.fn()} />);
  await escribir("Correo institucional", "alumno@example.test");
  await act(async () => vista.root.findByProps({ accessibilityLabel: "Continuar" }).props.onPress());
  expect(api.post).toHaveBeenCalledWith("/auth/solicitar-activacion", { email: "alumno@example.test" });
  await escribir("Código de verificación de 64 caracteres", "A".repeat(64));
  await act(async () => vista.root.findByProps({ accessibilityLabel: "Continuar" }).props.onPress());
  await escribir("Nueva contraseña", "Nueva_Segura_42!");
  await escribir("Confirmar nueva contraseña", "Distinta_42!");
  await act(async () => vista.root.findByProps({ accessibilityLabel: "Activar cuenta" }).props.onPress());
  expect(api.post).toHaveBeenCalledTimes(1);
  expect(texto()).toContain("no coinciden");
  await escribir("Confirmar nueva contraseña", "Nueva_Segura_42!");
  let resolver!: (valor: { data: { mensaje: string } }) => void;
  vi.mocked(api.post).mockReturnValueOnce(new Promise(r => { resolver = r; }));
  await act(async () => {
    const boton = vista.root.findByProps({ accessibilityLabel: "Activar cuenta" });
    boton.props.onPress(); boton.props.onPress();
  });
  expect(api.post).toHaveBeenCalledTimes(2);
  expect(api.post).toHaveBeenLastCalledWith("/auth/activar-cuenta", { token: "a".repeat(64), password: "Nueva_Segura_42!" });
  await act(async () => resolver({ data: { mensaje: "Cuenta activada" } }));
  expect(texto()).toContain("Cuenta activada");
  expect(vista.root.findAllByProps({ accessibilityLabel: "Código de activación" })).toHaveLength(0);
});

it("no abre el selector si la pantalla se desmonta durante el preflight", async () => {
  const tarea = { id: 3, titulo: "Trabajo", tipo: "TAREA", parcial: 1, fechaEntrega: null, entrega: null };
  vi.mocked(api.get).mockResolvedValueOnce({ data: {datos:[tarea],total:1} });
  await montar(<Tareas />);
  let resolver!: (valor: { data: {datos: typeof tarea[]; total: number} }) => void;
  vi.mocked(api.get).mockReturnValueOnce(new Promise(r => { resolver = r; }));
  await act(async () => vista.root.findByProps({ accessibilityLabel: "Entregar archivo: Trabajo" }).props.onPress());
  await act(async () => vista.unmount());
  await act(async () => resolver({ data: {datos:[tarea],total:1} }));
  expect(DocumentPicker.getDocumentAsync).not.toHaveBeenCalled();
  expect(api.post).not.toHaveBeenCalled();
});


it("CURP se oculta por defecto y vuelve a ocultarse tras 30 segundos", async () => {
  const curp = "GODE561231HDFRRN09";
  vi.mocked(api.get).mockResolvedValue({ data: { matricula: "PRIV-001", curp, usuario: { nombre: "Alumno", apellidoPaterno: "Prueba" }, plantel: { nombre: "Plantel" } } });
  await montar(<Perfil />);
  expect(texto()).not.toContain(curp);
  vi.useFakeTimers();
  try {
    await act(async () => vista.root.findByProps({ accessibilityLabel: "Mostrar CURP completa" }).props.onPress());
    expect(texto()).toContain(curp);
    const cambio = vi.mocked(AppState.addEventListener).mock.calls.at(-1)![1];
    await act(async () => cambio("background"));
    expect(texto()).not.toContain(curp);
    await act(async () => vista.root.findByProps({ accessibilityLabel: "Mostrar CURP completa" }).props.onPress());
    await act(async () => { vi.advanceTimersByTime(30_000); });
    expect(texto()).not.toContain(curp);
  } finally { vi.useRealTimers(); }
});


it("inicio permite abrir las secciones aunque el resumen siga cargando", async () => {
  vi.mocked(api.get).mockImplementation(() => new Promise(() => {}));
  await montar(<Inicio />);
  for (const [titulo, ruta] of [
    ["Materias y tareas", "Materias"],
    ["Ver últimas calificaciones", "Calificaciones"],
    ["Estado de cuenta", "Pagos"],
    ["Perfil y documentos", "Perfil"],
  ]) {
    await act(async () => vista.root.findByProps({ accessibilityLabel: titulo }).props.onPress());
    expect(sesion.navegar).toHaveBeenLastCalledWith(ruta);
  }
});

it("inicio no confunde un saldo no disponible con no tener adeudos", async () => {
  vi.mocked(api.get).mockImplementation(async (ruta) => {
    if (ruta === "/finanzas/me/estado-cuenta") throw new Error("Sin respuesta");
    return { data: [] };
  });
  await montar(<Inicio />);
  const textos = vista.root.findAllByType(Text).map((nodo) => nodo.props.children).flat().join(" ");
  expect(textos).toContain("No se pudo consultar tu saldo");
  expect(textos).not.toContain("No tienes saldo pendiente");
});

it('calificaciones pagina desde servidor y conserva el promedio oficial sin recargar boletas',async()=>{
 const nota=(nombre:string)=>({id:1,parcial:1,calificacion:80,promedioOficial:90,grupoMateriaId:1,grupoMateria:{materia:{clave:'MAT',nombre},grupo:{nombre:'A',ciclo:{id:1,nombre:'2026'}}}});
 vi.mocked(api.get).mockImplementation(async(ruta,config)=>({data:ruta==='/calificaciones/mias/listado'?{datos:[nota((config?.params as {pagina:number}).pagina===1?'Primera página':'Segunda página')],total:11}:[]}));
 await montar(<Calificaciones/>);expect(texto()).toContain('Primera página');
 const boletas=vi.mocked(api.get).mock.calls.filter(([ruta])=>ruta==='/reportes/mis-boletas').length;
 await act(async()=>vista.root.findByProps({accessibilityLabel:'Página siguiente'}).props.onPress());
 expect(api.get).toHaveBeenCalledWith('/calificaciones/mias/listado',{params:{pagina:2,porPagina:10}});expect(texto()).toContain('Segunda página');expect(texto()).not.toContain('Primera página');expect(texto()).toContain('90');expect(vi.mocked(api.get).mock.calls.filter(([ruta])=>ruta==='/reportes/mis-boletas')).toHaveLength(boletas);
});
it('el caché de calificaciones no usa la página uno para suplir una página dos sin conexión',async()=>{
 configurarCacheAcademica(1);
 const nota={id:1,parcial:1,calificacion:80,promedioOficial:null,grupoMateriaId:1,grupoMateria:{materia:{clave:'MAT',nombre:'Nota cacheada'},grupo:{nombre:'A',ciclo:{id:1,nombre:'2026'}}}};
 vi.mocked(api.get).mockImplementation(async(ruta,config)=>{
  if(ruta!=='/calificaciones/mias/listado') return {data:[]};
  if((config?.params as {pagina:number}).pagina===1)return {data:{datos:[nota],total:11}};
  throw Object.assign(new Error('Sin red en página dos'),{code:'ERR_NETWORK'});
 });
 await montar(<Calificaciones/>);expect(texto()).toContain('Nota cacheada');
 await act(async()=>vista.root.findByProps({accessibilityLabel:'Página siguiente'}).props.onPress());expect(texto()).not.toContain('Nota cacheada');expect(vista.root.findByProps({accessibilityLabel:'Reintentar carga'})).toBeTruthy();expect(texto()).not.toContain('copia de calificaciones de esta sesión');configurarCacheAcademica(null);
});

it('pagina tareas en servidor y vuelve a validar solo la página visible antes de entregar', async () => {
  const tarea = {id:3,titulo:'Trabajo paginado',tipo:'TAREA',parcial:1,fechaEntrega:null,entrega:null};
  vi.mocked(api.get).mockResolvedValue({data:{datos:[tarea],total:12}}); await montar(<Tareas />);
  await act(async () => vista.root.findByProps({accessibilityLabel:'Página siguiente'}).props.onPress());
  expect(api.get).toHaveBeenLastCalledWith('/alumnos/me/tareas/listado',{params:{pagina:2,porPagina:10}});
  vi.mocked(DocumentPicker.getDocumentAsync).mockResolvedValue({canceled:true,assets:null});
  await act(async () => vista.root.findByProps({accessibilityLabel:'Entregar archivo: Trabajo paginado'}).props.onPress());
  expect(api.get).toHaveBeenLastCalledWith('/alumnos/me/tareas/listado',{params:{pagina:2,porPagina:10}});
  expect(DocumentPicker.getDocumentAsync).toHaveBeenCalled();
});


it("restaura el contador de activación al remontar sin solicitar otro correo", async () => {
  vi.mocked(SecureStore.getItemAsync).mockResolvedValueOnce(JSON.stringify({ email: "alumno@example.test", hasta: Date.now() + 60_000 }));
  await montar(<ActivarCuenta volver={() => undefined} correoInicial="alumno@example.test" />);
  await act(async () => vista.root.findByProps({ accessibilityLabel: "Continuar" }).props.onPress());
  expect(api.post).not.toHaveBeenCalled();
  expect(texto()).toContain("Solicitar uno nuevo en");
  expect(vista.root.findByProps({ accessibilityLabel: "Código de verificación de 64 caracteres" })).toBeTruthy();
});

it("permite continuar después de solicitar el código si falla el almacenamiento local", async () => {
  vi.mocked(SecureStore.setItemAsync).mockRejectedValueOnce(new Error("almacenamiento no disponible"));
  await montar(<ActivarCuenta volver={() => undefined} correoInicial="alumno@example.test" />);
  await act(async () => vista.root.findByProps({ accessibilityLabel: "Continuar" }).props.onPress());
  expect(api.post).toHaveBeenCalledTimes(1);
  expect(vista.root.findByProps({ accessibilityLabel: "Código de verificación de 64 caracteres" })).toBeTruthy();
});

it("recupera desde Login, valida confirmación y limpia código y contraseñas al guardar", async () => {
  vi.mocked(api.post).mockResolvedValue({ data: { mensaje: "Si la cuenta existe, recibirás instrucciones" } });
  await montar(<Login />);
  await escribir("Correo institucional", " alumno@example.test ");
  await act(async () => vista.root.findByProps({ accessibilityLabel: "¿Olvidaste tu contraseña?" }).props.onPress());
  expect(texto()).toContain("Recupera tu contraseña");
  await act(async () => vista.root.findByProps({ accessibilityLabel: "Continuar" }).props.onPress());
  expect(api.post).toHaveBeenLastCalledWith("/auth/forgot-password", { email: "alumno@example.test" });
  await escribir("Código de verificación de 32 caracteres", "A".repeat(32));
  await act(async () => vista.root.findByProps({ accessibilityLabel: "Continuar" }).props.onPress());
  await escribir("Nueva contraseña", "Nueva_Segura_42!");
  await escribir("Confirmar nueva contraseña", "Diferente_42!");
  await act(async () => vista.root.findByProps({ accessibilityLabel: "Guardar nueva contraseña" }).props.onPress());
  expect(api.post).toHaveBeenCalledTimes(1);
  expect(texto()).toContain("no coinciden");
  await escribir("Confirmar nueva contraseña", "Nueva_Segura_42!");
  let resolver!: (v: {data: {mensaje: string}}) => void;
  vi.mocked(api.post).mockReturnValueOnce(new Promise(r => { resolver = r; }));
  await act(async () => {
    const boton = vista.root.findByProps({ accessibilityLabel: "Guardar nueva contraseña" });
    boton.props.onPress(); boton.props.onPress();
  });
  expect(api.post).toHaveBeenCalledTimes(2);
  expect(api.post).toHaveBeenLastCalledWith("/auth/reset-password", {token:"a".repeat(32),password:"Nueva_Segura_42!"});
  await act(async () => resolver({data:{mensaje:"Guardado"}}));
  expect(texto()).toContain("Contraseña actualizada");
  expect(texto()).not.toContain("Nueva_Segura_42!");
  expect(texto()).not.toContain("a".repeat(32));
});
it("permite usar el código recibido sin solicitar otro y conserva el flujo ante un código rechazado", async () => {
  await montar(<ActivarCuenta recuperacion volver={vi.fn()} />);
  await act(async () => vista.root.findByProps({ accessibilityLabel: "Ya tengo un código" }).props.onPress());
  expect(api.post).not.toHaveBeenCalled();
  await escribir("Código de verificación de 32 caracteres", "a".repeat(32));
  await act(async () => vista.root.findByProps({ accessibilityLabel: "Continuar" }).props.onPress());
  await escribir("Nueva contraseña", "Nueva_Segura_42!");
  await escribir("Confirmar nueva contraseña", "Nueva_Segura_42!");
  vi.mocked(api.post).mockRejectedValueOnce(new Error("Código vencido"));
  await act(async () => vista.root.findByProps({ accessibilityLabel: "Guardar nueva contraseña" }).props.onPress());
  expect(texto()).toContain("No se pudo completar");
  expect(texto()).not.toContain("Contraseña actualizada");
  expect(vista.root.findByProps({accessibilityLabel:"Guardar nueva contraseña"}).props.disabled).toBe(false);
});

it("los pendientes abren actividades y pagos y señalan datos anteriores cuando falla actualizar", async () => {
  vi.mocked(api.get).mockResolvedValueOnce({data:[{titulo:"Actividades sin entrega",cantidad:2},{titulo:"Cargos por cubrir",cantidad:1}]});
  await montar(<PendientesAlumno/>);
  const botones=vista.root.findAllByType(TouchableOpacity);
  await act(async () => botones[0].props.onPress());
  expect(sesion.navegar).toHaveBeenLastCalledWith("Materias");
  await act(async () => botones[1].props.onPress());
  expect(sesion.navegar).toHaveBeenLastCalledWith("Pagos");
  vi.mocked(api.get).mockRejectedValueOnce(new Error("Sin conexión"));
  await act(async () => botones[botones.length-1].props.onPress());
  expect(texto()).toContain("Los datos mostrados son de la consulta anterior");
  expect(texto()).not.toContain("No hay pendientes señalados");
});
