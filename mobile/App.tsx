import {
  configurarCacheAcademica,
  limpiarCacheAcademica,
} from "./src/api/cache-academica";
import * as Notifications from "expo-notifications";
import { activarPush, limpiarPreferenciaPushLocal } from "./src/push";
import { preferenciaBiometrica, desbloquearBiometria } from "./src/biometria";
import { CLAVE_ULTIMA_ACTIVIDAD, crearControlInactividad, crearPersistenciaActividad, actividadRestaurable } from "./src/utils/inactividad";
import { debeNotificarActividad } from "./src/utils/pulso-actividad";
import { ETIQUETAS_NAVEGACION } from "./src/utils/etiquetas-navegacion";
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  NavigationContainer,
  DefaultTheme,
  createNavigationContainerRef,
} from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, AppState, BackHandler, TouchableOpacity, View } from "react-native";
import { Text, FuenteContext } from "./src/components/Texto";
import { useFonts } from "expo-font";
import * as SecureStore from "expo-secure-store";
import {
  api,
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
  useMarca,
} from "./src/marca";

const navegacion = createNavigationContainerRef<{
  Inicio: undefined;
  Materias: undefined;
  Calificaciones: undefined;
  Pagos: undefined;
  Perfil: undefined;
}>();
const Tab = createBottomTabNavigator();
const PerfilStack = createNativeStackNavigator<{ MiPerfil: undefined; MisDocumentos: undefined }>();

function PerfilConDocumentos() {
  const { marca } = useMarca();
  return (
    <PerfilStack.Navigator screenOptions={{
      headerStyle: { backgroundColor: marca.colorPrimario },
      headerTintColor: textoSobreFondo(marca.colorPrimario),
    }}>
      <PerfilStack.Screen name="MiPerfil" options={{ title: "Perfil" }}>
        {({ navigation }) => <PerfilScreen abrirDocumentos={() => navigation.navigate("MisDocumentos")} />}
      </PerfilStack.Screen>
      <PerfilStack.Screen name="MisDocumentos" component={DocumentosScreen} options={{ title: "Mis documentos" }} />
    </PerfilStack.Navigator>
  );
}

const iconos: Record<string, string> = {
  Inicio: "🏠",
  Materias: "📚",
  Calificaciones: "🎓",
  Pagos: "💳",
  Perfil: "👤",
};

function AppInterna() {
  const fuenteLista = useContext(FuenteContext);
  const [sesion, setSesion] = useState<Sesion | null>(null);
  const [bloqueoBiometrico, setBloqueoBiometrico] = useState(false);
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
    setListo(false);
    setErrorInicio("");
    try {
      const token = await SecureStore.getItemAsync(TOKEN_KEY);
      if (token) {
        const usuarioBiometrico = await preferenciaBiometrica();
        if (usuarioBiometrico !== null) {
          if (!await desbloquearBiometria(usuarioBiometrico)) {
            setBloqueoBiometrico(true);
            return;
          }
          setBloqueoBiometrico(false);
        }
        const guardada = await SecureStore.getItemAsync(CLAVE_ULTIMA_ACTIVIDAD).catch(() => null);
        const ultima = actividadRestaurable(guardada, Date.now());
        if (ultima === null) {
          await eliminarTokensSesion();
          await persistenciaActividad.current.borrar();
          setAvisoCierre("La sesión se cerró tras 30 minutos sin actividad. Ingresa nuevamente.");
          return;
        }
        ultimaActividadGuardada.current = ultima;
        ultimaActividadPersistida.current = ultima;
        if (guardada === null) guardarActividad(ultima);
        try {
          const { data } = await api.get("/auth/me");
          setSesion({
            sub: data.id,
            email: data.email,
            nombre: data.nombreCompleto,
            roles: data.roles.map((r: { clave: string }) => r.clave),
            passwordChangeRequired: data.passwordChangeRequired,
          });
        } catch (error) {
          if (
            (error as { response?: { status?: number } }).response?.status !==
            401
          ) {
            setErrorInicio(mensajeDeError(error));
          }
        }
      }
    } catch (error) {
      setErrorInicio(mensajeDeError(error));
    } finally {
      setListo(true);
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
      configurarCacheAcademica(null);
      if (sesion?.sub) void limpiarPreferenciaPushLocal(sesion.sub);
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
    const { data } = await api.post("/auth/login", { email, password });
    await establecerTokensSesion(data.accessToken, data.refreshToken);
    const ahora = Date.now();
    ultimaActividadGuardada.current = ahora;
    ultimaActividadPersistida.current = ahora;
    ultimoAvisoServidor.current = ahora;
    guardarActividad(ahora);
    setAvisoCierre("");
    setBloqueoBiometrico(false);
    setSesion(data.usuario);
  };

  useEffect(() => {
    if (!sesion || sesion.passwordChangeRequired) return;
    const escuchar = () => {
      if (navegacion.isReady()) navegacion.navigate("Inicio");
    };
    const sub = Notifications.addNotificationResponseReceivedListener(escuchar);
    return () => sub.remove();
  }, [sesion]);

  const finalizarSesionLocal = async (motivo: "manual" | "inactividad" = "manual") => {
    controlInactividad.current?.detener();
    controlInactividad.current = null;
    configurarCacheAcademica(null);
    const borrarPreferenciaPush = sesion?.sub
      ? limpiarPreferenciaPushLocal(sesion.sub) : Promise.resolve();
    const borrarTokens = eliminarTokensSesion();
    const borrarActividad = persistenciaActividad.current.borrar();
    setSesion(null);
    setBloqueoBiometrico(false);
    setConsentimiento(null);
    setAvisoCierre(motivo === "inactividad"
      ? "La sesión se cerró tras 30 minutos sin actividad. Ingresa nuevamente." : "");
    await Notifications.dismissAllNotificationsAsync().catch(() => undefined);
    try {
      await borrarTokens;
    } finally {
      await Promise.all([borrarActividad, borrarPreferenciaPush]);
    }
  };

  const cerrar = async (motivo: "manual" | "inactividad" = "manual") => {
    const [token, refresh] = await Promise.all([
      SecureStore.getItemAsync(TOKEN_KEY).catch(() => null),
      SecureStore.getItemAsync(REFRESH_KEY).catch(() => null),
    ]);
    await finalizarSesionLocal(motivo);
    // El acceso de 15 minutos puede haber caducado; renovar SOLO para revocar el
    // dispositivo, sin restaurar los tokens ni la interfaz después del cierre.
    if ((token || refresh) && typeof fetch === "function") {
      void (async () => {
        const origen = api.defaults.baseURL;
        const retirar = (acceso: string) => fetch(`${origen}/auth/logout`, {
          method: "POST", headers: { Authorization: `Bearer ${acceso}`, "x-portal": "MOVIL" },
        });
        const respuesta = token ? await retirar(token) : null;
        if (respuesta?.status !== 401 && respuesta !== null) return;
        if (!refresh) return;
        const renovacion = await fetch(`${origen}/auth/refresh`, {
          method: "POST",
          headers: { "x-portal": "MOVIL", "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken: refresh }),
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
        <View style={{ flex: 1 }} onTouchStart={registrarInteraccion}>
        <NavigationContainer
          ref={navegacion}
          theme={tema}
          onReady={() => {
            if (sesion && Notifications.getLastNotificationResponse())
              navegacion.navigate("Inicio");
          }}
        >
          <StatusBar
            style={
              textoSobreFondo(marca.colorPrimario) === "#ffffff"
                ? "light"
                : "dark"
            }
          />
          {sesion ? (
            <Tab.Navigator
              key={sesion.sub}
              screenOptions={({ route }) => ({
                headerStyle: { backgroundColor: marca.colorPrimario },
                headerTintColor: textoSobreFondo(marca.colorPrimario),
                headerTitleStyle: {
                  fontFamily: fuenteLista ? "Onest" : undefined,
                  fontWeight: "700",
                },
                tabBarActiveTintColor: textoSobreFondo(colores.papel),
                tabBarInactiveTintColor: colores.gris,
                tabBarHideOnKeyboard: true,
                tabBarLabelStyle: {
                  fontFamily: fuenteLista ? "Onest" : undefined,
                  fontSize: 12,
                  fontWeight: "600",
                },
                tabBarItemStyle: { minHeight: 48 },
                tabBarAccessibilityLabel: ETIQUETAS_NAVEGACION[route.name] ?? route.name,
                tabBarStyle: {
                  backgroundColor: colores.papel,
                  borderTopColor: colores.linea,
                  minHeight: 68,
                  paddingTop: 6,
                },
                tabBarIcon: () => <Text accessible={false}>{iconos[route.name] ?? "•"}</Text>,
              })}
            >
              <Tab.Screen name="Inicio" component={InicioScreen} />
              <Tab.Screen name="Materias" component={MateriasScreen} />
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
              <Tab.Screen name="Perfil" component={PerfilConDocumentos} options={{ headerShown: false }} />
            </Tab.Navigator>
          ) : (
            <LoginScreen aviso={avisoCierre} />
          )}
        </NavigationContainer>
        </View>
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
      <AppInterna />
    </FuenteContext.Provider>
  );
}
