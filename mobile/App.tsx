import { AlertasWeb } from "./src/components/AlertasWeb";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { RecorridoAlumno } from './src/components/RecorridoAlumno';
import {
  configurarCacheAcademica,
  limpiarCacheAcademica,
} from "./src/api/cache-academica";
import * as Notifications from "expo-notifications";
import { activarPush, limpiarPreferenciaPushLocal } from "./src/push";
import { preferenciaBiometrica, desbloquearBiometria } from "./src/biometria";
import { CLAVE_ULTIMA_ACTIVIDAD, crearControlInactividad, crearPersistenciaActividad, actividadRestaurable } from "./src/utils/inactividad";
import { debeNotificarActividad } from "./src/utils/pulso-actividad";
import { CabeceraAlumno, NavegacionAlumno } from './src/components/PortalAlumno';
import { AnchoPortalContext, IdentidadAlumnoContext } from './src/portal-alumno';
import { CalendarioAlumnoScreen, TramitesAlumnoScreen } from './src/screens/ServiciosAlumno';
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  NavigationContainer,
  DefaultTheme,
  createNavigationContainerRef,
} from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, AppState, BackHandler, Platform, TouchableOpacity, View, useWindowDimensions } from "react-native";
import { Text, FuenteContext } from "./src/components/Texto";
import { useFonts } from "expo-font";
import * as SecureStore from "./src/almacen-seguro";
import {
  api,
  archivosBase,
  mensajeDeError,
  registrarSesionExpirada,
  TOKEN_KEY,
  REFRESH_KEY,
  establecerTokensSesion,
  eliminarTokensSesion,
} from "./src/api/client";
import { Sesion, SesionContext } from "./src/sesion";
import { colores, textoSobreFondo } from "./src/theme";
import CambioPasswordInicial from "./src/screens/CambioPasswordInicial";
import LoginScreen from "./src/screens/Login";
import InicioScreen from "./src/screens/Inicio";
import ConsentimientoInstitucional, { EstadoConsentimiento } from "./src/screens/ConsentimientoInstitucional";
import TareasScreen from "./src/screens/Tareas";
import MateriasScreen from "./src/screens/Materias";
import CalificacionesScreen from "./src/screens/Calificaciones";
import EstadoCuentaScreen from "./src/screens/EstadoCuenta";
import PerfilScreen from "./src/screens/Perfil";
import DocumentosScreen from "./src/screens/Documentos";
import { cargarMarca, esMarcaValida, mismaMarca } from "./src/marca-carga";
import {
  aplicarColores,
  MARCA_CACHE_KEY,
  MARCA_POR_DEFECTO,
  Marca,
  MarcaContext,
} from "./src/marca";

const navegacion = createNavigationContainerRef<{
  Inicio: undefined;
  Materias: { screen: "MisMaterias" | "MisTareas" } | undefined;
  Calificaciones: undefined;
  Pagos: undefined;
  Perfil: undefined;
  Calendario: undefined;
  Tramites: { vista?: import("./src/recorrido-alumno").VistaSeguimientoAlumno } | undefined;
}>();
const Tab = createBottomTabNavigator();
const PerfilStack = createNativeStackNavigator<{ MiPerfil: undefined; MisDocumentos: undefined }>();

function PerfilConDocumentos() {
  return (
    <PerfilStack.Navigator screenOptions={{
      headerStyle: { backgroundColor: "#fff" },
      headerTintColor: colores.tinta,
    }}>
      <PerfilStack.Screen name="MiPerfil" options={{ title: "Perfil", headerShown: false }}>
        {({ navigation }) => <PerfilScreen abrirDocumentos={() => navigation.navigate("MisDocumentos")} />}
      </PerfilStack.Screen>
      <PerfilStack.Screen name="MisDocumentos" component={DocumentosScreen} options={{ title: "Mis documentos" }} />
    </PerfilStack.Navigator>
  );
}

const MateriasStack = createNativeStackNavigator<{ MisMaterias: undefined; MisTareas: undefined }>();
function MateriasConTareas() {
  return <MateriasStack.Navigator screenOptions={{ headerStyle: { backgroundColor: "#fff" }, headerTintColor: colores.tinta }}>
    <MateriasStack.Screen name="MisMaterias" options={{ title: "Materias", headerShown: false }}>
      {({ navigation }) => <MateriasScreen abrirTareas={() => navigation.navigate("MisTareas")} />}
    </MateriasStack.Screen>
    <MateriasStack.Screen name="MisTareas" component={TareasScreen} options={{ title: "Tareas y entregas" }} />
  </MateriasStack.Navigator>;
}

function AppInterna() {
  const { width, fontScale } = useWindowDimensions();
  const escritorio = width >= 1000 && fontScale <= 1.3;
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [identidadAlumno, setIdentidadAlumno] = useState<{ usuarioId: number; matricula: string; estatus: string } | null>(null);
  const [sesion, setSesion] = useState<Sesion | null>(null);
  useEffect(() => {
    let vigente = true;
    setIdentidadAlumno(null);
    setMenuAbierto(false);
    if (sesion?.sub) void api.get<{ matricula: string; estatus: string }>('/alumnos/me/perfil').then(({ data }) => {
      if (vigente) setIdentidadAlumno({ usuarioId: sesion.sub, matricula: data.matricula, estatus: data.estatus });
    }).catch(() => { /* Los detalles del perfil se pueden reintentar desde Mi perfil. */ });
    return () => { vigente = false; };
  }, [sesion?.sub]);
  const [bloqueoBiometrico, setBloqueoBiometrico] = useState(false);
  const usuarioEnDesbloqueo = useRef<number | null>(null);
  const revisionSesion = useRef(0);
  const [consentimiento, setConsentimiento] = useState<EstadoConsentimiento | null>(null);
  const [errorConsentimiento, setErrorConsentimiento] = useState("");
  const consultarConsentimiento = useCallback(async () => {
    setConsentimiento(null); setErrorConsentimiento("");
    try { const { data } = await api.get<EstadoConsentimiento>("/auth/consentimiento"); setConsentimiento(data); }
    catch (e) { setErrorConsentimiento(mensajeDeError(e)); }
  }, []);
  const [avisoCierre, setAvisoCierre] = useState("");
  const ultimaActividadGuardada = useRef(Date.now());
  const ultimaActividadPersistida = useRef(0);
  const ultimoAvisoServidor = useRef(0);
  const persistenciaActividad = useRef(crearPersistenciaActividad(
    (fecha) => SecureStore.setItemAsync(CLAVE_ULTIMA_ACTIVIDAD, String(fecha)),
    () => SecureStore.deleteItemAsync(CLAVE_ULTIMA_ACTIVIDAD),
  ));
  const controlInactividad = useRef<ReturnType<typeof crearControlInactividad> | null>(null);
  const guardarActividad = (fecha: number) => { void persistenciaActividad.current.guardar(fecha); };
  useEffect(() => {
    if (sesion?.sub && !sesion.passwordChangeRequired) void consultarConsentimiento();
    else setConsentimiento(null);
  }, [sesion?.sub, sesion?.passwordChangeRequired, consultarConsentimiento]);
  useEffect(() => {
    configurarCacheAcademica(sesion?.sub ?? null);
    return () => limpiarCacheAcademica();
  }, [sesion?.sub]);
  const [listo, setListo] = useState(false);
  const [marca, setMarca] = useState<Marca>(MARCA_POR_DEFECTO);
  const marcaActual = useRef<Marca>(MARCA_POR_DEFECTO);
  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined") return;
    document.title = marca.nombrePortalAlumno || "Sistema Escolar Portal Alumno";
    const enlaceActual = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (marca.faviconAlumnoUrl) {
      let icono = enlaceActual;
      if (!icono) {
        icono = document.createElement('link');
        icono.rel = 'icon';
        icono.dataset.escolarFaviconAgregado = 'true';
        document.head.appendChild(icono);
      } else if (icono.dataset.escolarFaviconOriginal === undefined) {
        icono.dataset.escolarFaviconOriginal = icono.getAttribute('href') ?? '';
      }
      icono.type = 'image/png';
      icono.href = archivosBase + marca.faviconAlumnoUrl;
    } else if (enlaceActual?.dataset.escolarFaviconAgregado === 'true') {
      enlaceActual.remove();
    } else if (enlaceActual?.dataset.escolarFaviconOriginal !== undefined) {
      enlaceActual.setAttribute('href', enlaceActual.dataset.escolarFaviconOriginal);
      delete enlaceActual.dataset.escolarFaviconOriginal;
    }
  }, [marca.nombrePortalAlumno, marca.faviconAlumnoUrl]);
  const consultaMarca = useRef<Promise<void> | null>(null);
  const [marcaLista, setMarcaLista] = useState(false);
  const [errorInicio, setErrorInicio] = useState("");

  const aplicarMarcaActual = useCallback((nueva: Marca) => {
    if (mismaMarca(marcaActual.current, nueva)) return;
    marcaActual.current = nueva;
    aplicarColores(nueva);
    setMarca(nueva);
  }, []);

  const revalidarMarca = useCallback((): Promise<void> => {
    if (consultaMarca.current) return consultaMarca.current;
    const consulta = (async () => {
      try {
        const { data } = await api.get<Marca>("/configuracion/marca");
        if (!esMarcaValida(data)) return;
        if (mismaMarca(marcaActual.current, data)) return;
        aplicarMarcaActual(data);
        await SecureStore.setItemAsync(MARCA_CACHE_KEY, JSON.stringify(data)).catch(() => undefined);
      } catch {
        /* Sin red: mostrar la última marca válida desde el dispositivo. */
      }
    })().finally(() => { if (consultaMarca.current === consulta) consultaMarca.current = null; });
    consultaMarca.current = consulta;
    return consulta;
  }, [aplicarMarcaActual]);

  useEffect(() => {
    const activar = () => {
      if (AppState.currentState === "active") void revalidarMarca();
    };
    const suscripcion = AppState.addEventListener("change", (estado) => {
      if (estado === "active") void revalidarMarca();
    });
    const intervalo = setInterval(activar, 60_000);
    return () => { suscripcion.remove(); clearInterval(intervalo); };
  }, [revalidarMarca]);

  const tema = useMemo(
    () => ({
      ...DefaultTheme,
      colors: {
        ...DefaultTheme.colors,
        primary: marca.colorPrimario,
        background: colores.papel,
        card: marca.colorPrimario,
        text: colores.tinta,
        border: colores.linea,
      },
    }),
    [marca],
  );

  const restaurarSesion = useCallback(async () => {
    const revision = ++revisionSesion.current;
    setListo(false);
    setErrorInicio("");
    try {
      const token = await SecureStore.getItemAsync(TOKEN_KEY);
      if (revision !== revisionSesion.current) return;
      if (token) {
        const usuarioBiometrico = await preferenciaBiometrica();
        if (revision !== revisionSesion.current) return;
        usuarioEnDesbloqueo.current = usuarioBiometrico;
        const guardada = await SecureStore.getItemAsync(CLAVE_ULTIMA_ACTIVIDAD).catch(() => null);
        if (revision !== revisionSesion.current) return;
        const ultima = actividadRestaurable(guardada, Date.now());
        if (ultima === null) {
          configurarCacheAcademica(null);
          if (usuarioBiometrico !== null) await limpiarPreferenciaPushLocal(usuarioBiometrico).catch(() => undefined);
          await eliminarTokensSesion();
          await persistenciaActividad.current.borrar();
          usuarioEnDesbloqueo.current = null;
          setBloqueoBiometrico(false);
          setAvisoCierre("La sesión se cerró tras 30 minutos sin actividad. Ingresa nuevamente.");
          return;
        }
        if (usuarioBiometrico !== null) {
          const desbloqueado = await desbloquearBiometria(usuarioBiometrico);
          if (revision !== revisionSesion.current) return;
          if (!desbloqueado) {
            setBloqueoBiometrico(true);
            return;
          }
          setBloqueoBiometrico(false);
        }
        ultimaActividadGuardada.current = ultima;
        ultimaActividadPersistida.current = ultima;
        if (guardada === null) guardarActividad(ultima);
        try {
          const { data } = await api.get("/auth/me");
          if (revision !== revisionSesion.current) return;
          if (usuarioBiometrico !== null && data.id !== usuarioBiometrico) {
            await eliminarTokensSesion();
            setAvisoCierre("La cuenta cambió. Ingresa nuevamente para verificar tu identidad.");
            return;
          }
          setSesion({
            sub: data.id,
            email: data.email,
            nombre: data.nombreCompleto,
            roles: data.roles.map((r: { clave: string }) => r.clave),
            passwordChangeRequired: data.passwordChangeRequired,
          });
        } catch (error) {
          if (revision !== revisionSesion.current) return;
          if (
            (error as { response?: { status?: number } }).response?.status !==
            401
          ) {
            setErrorInicio(mensajeDeError(error));
          }
        }
      }
    } catch (error) {
      if (revision !== revisionSesion.current) return;
      setErrorInicio(mensajeDeError(error));
    } finally {
      if (revision === revisionSesion.current) setListo(true);
    }
  }, []);

  useEffect(() => {
    void restaurarSesion();
  }, [restaurarSesion]);

  useEffect(() => {
    let activa = true;
    void cargarMarca(
      {
        leer: () => SecureStore.getItemAsync(MARCA_CACHE_KEY),
        eliminar: () => SecureStore.deleteItemAsync(MARCA_CACHE_KEY),
        guardar: (valor) => SecureStore.setItemAsync(MARCA_CACHE_KEY, valor),
        consultar: async () =>
          (await api.get<Marca>("/configuracion/marca")).data,
      },
      MARCA_POR_DEFECTO,
      (valor) => {
        if (activa) {
          aplicarMarcaActual(valor);
          setMarcaLista(true);
        }
      },
    )
      .then((valor) => {
        if (activa) aplicarMarcaActual(valor);
      })
      .finally(() => {
        if (activa) setMarcaLista(true);
      });
    return () => {
      activa = false;
    };
  }, [aplicarMarcaActual]);

  useEffect(() => {
    registrarSesionExpirada(() => {
      revisionSesion.current++;
      setListo(true);
      configurarCacheAcademica(null);
      if (sesion?.sub) void limpiarPreferenciaPushLocal(sesion.sub).catch(() => undefined);
      void persistenciaActividad.current.borrar().catch(() => undefined);
      if (Platform.OS !== "web") void Notifications.dismissAllNotificationsAsync().catch(() => undefined);
      setBloqueoBiometrico(false);
      setSesion(null);
    });
    return () => registrarSesionExpirada(null);
  }, [sesion?.sub]);

  useEffect(() => {
    if (sesion && !sesion.passwordChangeRequired && consentimiento && !consentimiento.pendiente)
      void activarPush(sesion.sub, false).catch(() => undefined);
  }, [sesion, consentimiento?.pendiente]);

  const iniciar = async (email: string, password: string) => {
    const revision = ++revisionSesion.current;
    const { data } = await api.post(Platform.OS === "web" ? "/auth/login-alumno-web" : "/auth/login", { email, password });
    if (revision !== revisionSesion.current) throw new Error("La sesión cambió. Vuelve a iniciar sesión.");
    if (!data.usuario.roles.includes("ALUMNO")) throw new Error("Esta aplicación es exclusiva para alumnos. Usa el portal administrativo.");
    await establecerTokensSesion(data.accessToken, data.refreshToken);
    if (revision !== revisionSesion.current) return;
    const ahora = Date.now();
    ultimaActividadGuardada.current = ahora;
    ultimaActividadPersistida.current = ahora;
    ultimoAvisoServidor.current = ahora;
    guardarActividad(ahora);
    setAvisoCierre("");
    usuarioEnDesbloqueo.current = null;
    setBloqueoBiometrico(false);
    setSesion(data.usuario);
  };

  useEffect(() => {
    if (!sesion || sesion.passwordChangeRequired || Platform.OS === "web") return;
    const escuchar = () => {
      if (navegacion.isReady()) navegacion.navigate("Inicio");
    };
    const sub = Notifications.addNotificationResponseReceivedListener(escuchar);
    return () => sub.remove();
  }, [sesion]);

  const finalizarSesionLocal = async (motivo: "manual" | "inactividad" = "manual") => {
    revisionSesion.current++;
    setListo(true);
    controlInactividad.current?.detener();
    controlInactividad.current = null;
    configurarCacheAcademica(null);
    const usuarioParaLimpiar = sesion?.sub ?? usuarioEnDesbloqueo.current;
    usuarioEnDesbloqueo.current = null;
    const borrarPreferenciaPush = usuarioParaLimpiar !== null
      ? limpiarPreferenciaPushLocal(usuarioParaLimpiar) : Promise.resolve();
    const borrarTokens = eliminarTokensSesion();
    const borrarActividad = persistenciaActividad.current.borrar();
    setSesion(null);
    setBloqueoBiometrico(false);
    setConsentimiento(null);
    setAvisoCierre(motivo === "inactividad"
      ? "La sesión se cerró tras 30 minutos sin actividad. Ingresa nuevamente." : "");
    if (Platform.OS !== "web") await Notifications.dismissAllNotificationsAsync().catch(() => undefined);
    try {
      await borrarTokens;
    } finally {
      await Promise.all([borrarActividad, borrarPreferenciaPush]);
    }
  };

  const cerrar = async (motivo: "manual" | "inactividad" = "manual") => {
    const revision = ++revisionSesion.current;
    setListo(true);
    const [token, refresh] = await Promise.all([
      SecureStore.getItemAsync(TOKEN_KEY).catch(() => null),
      SecureStore.getItemAsync(REFRESH_KEY).catch(() => null),
    ]);
    if (revision !== revisionSesion.current) return;
    await finalizarSesionLocal(motivo);
    // El acceso de 15 minutos puede haber caducado; renovar SOLO para revocar el
    // dispositivo, sin restaurar los tokens ni la interfaz después del cierre.
    if ((token || refresh) && typeof fetch === "function") {
      void (async () => {
        const origen = api.defaults.baseURL;
        const retirar = (acceso: string) => fetch(`${origen}/auth/logout`, {
          method: "POST", credentials: Platform.OS === "web" ? "include" : "omit",
          headers: { Authorization: `Bearer ${acceso}`, "x-portal": Platform.OS === "web" ? "WEB" : "MOVIL" },
        });
        const respuesta = token ? await retirar(token) : null;
        if (respuesta?.status !== 401 && respuesta !== null) return;
        if (!refresh && Platform.OS !== "web") return;
        const renovacion = await fetch(`${origen}/auth/refresh`, {
          method: "POST",
          credentials: Platform.OS === "web" ? "include" : "omit",
          headers: { "x-portal": Platform.OS === "web" ? "WEB" : "MOVIL", "Content-Type": "application/json" },
          body: JSON.stringify(Platform.OS === "web" ? {} : { refreshToken: refresh }),
        });
        if (!renovacion.ok) return;
        const datos: { accessToken?: string } = await renovacion.json();
        if (datos.accessToken) await retirar(datos.accessToken);
      })().catch(() => undefined);
    }
  };

  useEffect(() => {
    if (!sesion?.sub) return;
    const control = crearControlInactividad(
      () => { void cerrar("inactividad"); },
      Date.now, setTimeout, clearTimeout, ultimaActividadGuardada.current,
    );
    controlInactividad.current = control;
    const app = AppState.addEventListener("change", (estado) => {
      if (estado === "active") { control.comprobar(); void consultarConsentimiento(); }
      else guardarActividad(control.ultimaActividad());
    });
    const atras = BackHandler.addEventListener("hardwareBackPress", () => {
      registrarInteraccion();
      return false;
    });
    return () => {
      control.detener();
      if (controlInactividad.current === control) controlInactividad.current = null;
      app.remove();
      atras.remove();
    };
  }, [sesion?.sub, consultarConsentimiento]);

  const registrarInteraccion = () => {
    const control = controlInactividad.current;
    if (!control) return;
    control.actividad();
    const fecha = control.ultimaActividad();
    if (sesion?.sub && debeNotificarActividad(ultimoAvisoServidor.current, fecha)) {
      ultimoAvisoServidor.current = fecha;
      void api.post("/auth/actividad").catch(() => undefined);
    }
    if (fecha - ultimaActividadPersistida.current >= 5000) {
      ultimaActividadPersistida.current = fecha;
      guardarActividad(fecha);
    }
  };

  const interaccionActual = useRef(registrarInteraccion);
  interaccionActual.current = registrarInteraccion;
  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined") return;
    const actividad = () => interaccionActual.current();
    document.addEventListener("keydown", actividad);
    document.addEventListener("pointerdown", actividad);
    return () => { document.removeEventListener("keydown", actividad); document.removeEventListener("pointerdown", actividad); };
  }, []);

  if (!listo || !marcaLista) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colores.papel,
        }}
      >
        <ActivityIndicator
          color={marca.colorPrimario}
          accessibilityLabel="Cargando aplicación"
        />
      </View>
    );
  }

  if (bloqueoBiometrico) return (
    <MarcaContext.Provider value={{ marca }}>
      <View style={{ flex: 1, justifyContent: "center", padding: 28, gap: 20, backgroundColor: colores.papel }}>
        <Text accessibilityRole="header" style={{ fontSize: 28, fontWeight: "700", color: colores.tinta }}>🔒 Tu espacio escolar</Text>
        <Text style={{ fontSize: 16, color: colores.gris }}>Verifica tu huella o rostro para volver a consultar tu información. No guardamos datos biométricos.</Text>
        <TouchableOpacity accessibilityRole="button" onPress={() => void restaurarSesion()}
          style={{ backgroundColor: marca.colorPrimario, padding: 16, borderRadius: 12, minHeight: 52, justifyContent: "center" }}>
          <Text style={{ color: textoSobreFondo(marca.colorPrimario), fontWeight: "700", textAlign: "center" }}>Desbloquear con biometría</Text>
        </TouchableOpacity>
        <TouchableOpacity accessibilityRole="button" onPress={() => void cerrar()} style={{ minHeight: 48, justifyContent: "center" }}>
          <Text style={{ color: colores.tinta, textAlign: "center" }}>Cerrar sesión y usar otra cuenta</Text>
        </TouchableOpacity>
      </View>
    </MarcaContext.Provider>
  );

  if (sesion?.passwordChangeRequired)
    return (
      <CambioPasswordInicial
        guardar={async (actual, nueva) => {
          await api.post("/auth/cambiar-password", { actual, nueva });
          await finalizarSesionLocal();
        }}
      />
    );

  if (sesion && !sesion.passwordChangeRequired && (consentimiento === null || consentimiento.pendiente)) {
    return <MarcaContext.Provider value={{ marca }}><View style={{ flex: 1, backgroundColor: colores.papel }}>
      {consentimiento?.pendiente ? <ConsentimientoInstitucional estado={consentimiento} actualizar={setConsentimiento} salir={() => void cerrar()} /> :
      <View style={{ flex: 1, justifyContent: "center", padding: 24, gap: 14 }}>
        <Text accessibilityRole="header">Verificando documentos institucionales</Text>
        {errorConsentimiento ? <Text accessibilityRole="alert">{errorConsentimiento}</Text> : <ActivityIndicator accessibilityLabel="Comprobando consentimiento" />}
        <TouchableOpacity accessibilityRole="button" onPress={() => void consultarConsentimiento()} style={{ minHeight: 48 }}><Text>Reintentar</Text></TouchableOpacity>
        <TouchableOpacity accessibilityRole="button" onPress={() => void cerrar()} style={{ minHeight: 48 }}><Text>Cerrar sesión</Text></TouchableOpacity>
      </View>}
    </View></MarcaContext.Provider>;
  }

  if (errorInicio) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
          backgroundColor: colores.papel,
        }}
      >
        <Text
          accessibilityRole="alert"
          style={{
            color: colores.peligro,
            textAlign: "center",
            marginBottom: 16,
          }}
        >
          No se pudo comprobar tu sesión. {errorInicio}
        </Text>
        <TouchableOpacity
          onPress={() => {
            void restaurarSesion();
          }}
          accessibilityRole="button"
          accessibilityLabel="Reintentar sesión"
          style={{ backgroundColor: marca.colorPrimario, padding: 14 }}
        >
          <Text style={{ color: textoSobreFondo(marca.colorPrimario) }}>
            Reintentar
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <MarcaContext.Provider value={{ marca }}>
      <SesionContext.Provider
        value={{ sesion, iniciar, cerrar, finalizarSesionLocal }}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor:sesion ? colores.papel : marca.colorPrimario }} edges={sesion ? ["left","right","top"] : ["left","right","top","bottom"]} onTouchStart={registrarInteraccion}>
        <NavigationContainer
          ref={navegacion}
          theme={tema}
          onReady={() => {
            if (Platform.OS !== "web" && sesion && Notifications.getLastNotificationResponse())
              navegacion.navigate("Inicio");
          }}
        >
          <StatusBar
            style={
              sesion ? 'dark' : textoSobreFondo(marca.colorPrimario) === "#ffffff" ? "light" : "dark"
            }
          />
          {sesion ? (
            <IdentidadAlumnoContext.Provider value={identidadAlumno?.usuarioId === sesion.sub ? identidadAlumno : {}}>
            <CabeceraAlumno escritorio={escritorio} menuAbierto={menuAbierto} alternarMenu={() => setMenuAbierto(v => !v)}
              abrirPerfil={() => { if (navegacion.isReady()) navegacion.navigate('Perfil'); }} />
            <AnchoPortalContext.Provider value={escritorio ? width - (menuAbierto ? 264 : 88) : width}>
            <Tab.Navigator
              key={sesion.sub}
              tabBar={props => <NavegacionAlumno {...props} escritorio={escritorio} menuAbierto={menuAbierto} cerrarMenu={() => setMenuAbierto(false)} />}
              screenOptions={{
                headerShown: false,
                tabBarPosition: escritorio ? 'left' : 'bottom',
                tabBarStyle: escritorio ? { width: menuAbierto ? 264 : 88 } : undefined,
                sceneStyle: { backgroundColor: colores.papel },
              }}
            >
              <Tab.Screen name="Inicio" component={InicioScreen} />
              <Tab.Screen name="Materias" component={MateriasConTareas} options={{ headerShown: false }} />
              <Tab.Screen
                name="Calificaciones"
                component={CalificacionesScreen}
                options={{ tabBarLabel: "Notas" }}
              />
              <Tab.Screen
                name="Pagos"
                component={EstadoCuentaScreen}
                options={{ title: "Estado de cuenta", tabBarLabel: "Cuenta" }}
              />
              <Tab.Screen name="Calendario" component={CalendarioAlumnoScreen} />
              <Tab.Screen name="Tramites" component={TramitesAlumnoScreen} />
              <Tab.Screen name="Perfil" component={PerfilConDocumentos} options={{ headerShown: false }} />
            </Tab.Navigator>
            </AnchoPortalContext.Provider>
            </IdentidadAlumnoContext.Provider>
          ) : (
            <LoginScreen aviso={avisoCierre} />
          )}
        </NavigationContainer>
        {sesion&&<RecorridoAlumno key={sesion.sub} usuarioId={sesion.sub} navegar={(pantalla,paso)=>{if(!navegacion.isReady())return;
          if(pantalla==='Materias')navegacion.navigate('Materias',{screen:paso?.subpantalla ?? 'MisMaterias'});
          else if(pantalla==='Tramites')navegacion.navigate('Tramites',{vista:paso?.vista ?? 'tramites'});
          else navegacion.navigate(pantalla);
        }}/>}
        </SafeAreaView>
      </SesionContext.Provider>
    </MarcaContext.Provider>
  );
}

/** Se empaqueta la fuente OFL en el APK/IPA: sin peticiones de red para renderizar Onest. */
export default function App() {
  const [fuenteLista, errorFuente] = useFonts({
    Onest: require("./src/assets/fonts/OnestVariable.ttf"),
  });
  if (!fuenteLista && !errorFuente) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: colores.papel,
        }}
      >
        <ActivityIndicator
          accessibilityLabel="Preparando tipografía"
          color={colores.pizarra}
        />
      </View>
    );
  }
  return (
    <FuenteContext.Provider value={fuenteLista}>
      <SafeAreaProvider><AppInterna /><AlertasWeb /></SafeAreaProvider>
    </FuenteContext.Provider>
  );
}
