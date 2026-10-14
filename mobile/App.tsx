import {
  configurarCacheAcademica,
  limpiarCacheAcademica,
} from "./src/api/cache-academica";
import * as Notifications from "expo-notifications";
import { activarPush } from "./src/push";
import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  NavigationContainer,
  DefaultTheme,
  createNavigationContainerRef,
} from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, TouchableOpacity, View } from "react-native";
import { Text, FuenteContext } from "./src/components/Texto";
import { useFonts } from "expo-font";
import * as SecureStore from "expo-secure-store";
import {
  api,
  mensajeDeError,
  registrarSesionExpirada,
  TOKEN_KEY,
  establecerTokensSesion,
  eliminarTokensSesion,
} from "./src/api/client";
import { Sesion, SesionContext } from "./src/sesion";
import { colores, textoSobreFondo } from "./src/theme";
import CambioPasswordInicial from "./src/screens/CambioPasswordInicial";
import LoginScreen from "./src/screens/Login";
import InicioScreen from "./src/screens/Inicio";
import MateriasScreen from "./src/screens/Materias";
import TareasScreen from "./src/screens/Tareas";
import CalificacionesScreen from "./src/screens/Calificaciones";
import EstadoCuentaScreen from "./src/screens/EstadoCuenta";
import PerfilScreen from "./src/screens/Perfil";
import { cargarMarca } from "./src/marca-carga";
import {
  aplicarColores,
  MARCA_CACHE_KEY,
  MARCA_POR_DEFECTO,
  Marca,
  MarcaContext,
} from "./src/marca";

const navegacion = createNavigationContainerRef<{
  Inicio: undefined;
  Materias: undefined;
  Tareas: undefined;
  Calificaciones: undefined;
  Pagos: undefined;
  Perfil: undefined;
}>();
const Tab = createBottomTabNavigator();

const iconos: Record<string, string> = {
  Inicio: "🏠",
  Materias: "📚",
  Tareas: "📝",
  Calificaciones: "🎓",
  Pagos: "💳",
  Perfil: "👤",
};

function AppInterna() {
  const fuenteLista = useContext(FuenteContext);
  const [sesion, setSesion] = useState<Sesion | null>(null);
  useEffect(() => {
    configurarCacheAcademica(sesion?.sub ?? null);
    return () => limpiarCacheAcademica();
  }, [sesion?.sub]);
  const [listo, setListo] = useState(false);
  const [marca, setMarca] = useState<Marca>(MARCA_POR_DEFECTO);
  const [marcaLista, setMarcaLista] = useState(false);
  const [errorInicio, setErrorInicio] = useState("");

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
          aplicarColores(valor);
          setMarca(valor);
          setMarcaLista(true);
        }
      },
    )
      .then((valor) => {
        if (activa) {
          aplicarColores(valor);
          setMarca(valor);
        }
      })
      .finally(() => {
        if (activa) setMarcaLista(true);
      });
    return () => {
      activa = false;
    };
  }, []);

  useEffect(() => {
    registrarSesionExpirada(() => {
      configurarCacheAcademica(null);
      setSesion(null);
    });
    return () => registrarSesionExpirada(null);
  }, []);

  useEffect(() => {
    if (sesion && !sesion.passwordChangeRequired)
      void activarPush(sesion.sub, false).catch(() => undefined);
  }, [sesion]);

  const iniciar = async (email: string, password: string) => {
    const { data } = await api.post("/auth/login", { email, password });
    await establecerTokensSesion(data.accessToken, data.refreshToken);
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

  const finalizarSesionLocal = async () => {
    await Notifications.dismissAllNotificationsAsync().catch(() => undefined);
    configurarCacheAcademica(null);
    await eliminarTokensSesion();
    setSesion(null);
  };

  const cerrar = async () => {
    await api.post("/auth/logout");
    await finalizarSesionLocal();
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

  if (sesion?.passwordChangeRequired)
    return (
      <CambioPasswordInicial
        guardar={async (actual, nueva) => {
          await api.post("/auth/cambiar-password", { actual, nueva });
          await finalizarSesionLocal();
        }}
      />
    );

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
                  fontSize: 11,
                  fontWeight: "600",
                },
                tabBarItemStyle: { minHeight: 48 },
                tabBarStyle: {
                  backgroundColor: colores.papel,
                  borderTopColor: colores.linea,
                  minHeight: 68,
                  paddingTop: 6,
                },
                tabBarIcon: () => <Text>{iconos[route.name] ?? "•"}</Text>,
              })}
            >
              <Tab.Screen name="Inicio" component={InicioScreen} />
              <Tab.Screen name="Materias" component={MateriasScreen} />
              <Tab.Screen name="Tareas" component={TareasScreen} />
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
              <Tab.Screen name="Perfil" component={PerfilScreen} />
            </Tab.Navigator>
          ) : (
            <LoginScreen />
          )}
        </NavigationContainer>
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
