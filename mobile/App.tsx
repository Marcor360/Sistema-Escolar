import { useEffect, useMemo, useState } from 'react';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { Text } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { api, TOKEN_KEY } from './src/api/client';
import { Sesion, SesionContext } from './src/sesion';
import { colores } from './src/theme';
import LoginScreen from './src/screens/Login';
import InicioScreen from './src/screens/Inicio';
import MateriasScreen from './src/screens/Materias';
import TareasScreen from './src/screens/Tareas';
import CalificacionesScreen from './src/screens/Calificaciones';
import EstadoCuentaScreen from './src/screens/EstadoCuenta';
import PerfilScreen from './src/screens/Perfil';
import { aplicarColores, MARCA_CACHE_KEY, MARCA_POR_DEFECTO, Marca, MarcaContext } from './src/marca';

const Tab = createBottomTabNavigator();

const iconos: Record<string, string> = {
  Inicio: '🏠', Materias: '📚', Tareas: '📝', Calificaciones: '🎓', Pagos: '💳', Perfil: '👤',
};

export default function App() {
  const [sesion, setSesion] = useState<Sesion | null>(null);
  const [listo, setListo] = useState(false);
  const [marca, setMarca] = useState<Marca>(MARCA_POR_DEFECTO);
  const [marcaLista, setMarcaLista] = useState(false);

  const tema = useMemo(() => ({
    ...DefaultTheme,
    colors: {
      ...DefaultTheme.colors,
      primary: marca.colorPrimario,
      background: colores.papel,
      card: marca.colorPrimario,
      text: colores.tinta,
      border: colores.linea,
    },
  }), [marca]);

  useEffect(() => {
    (async () => {
      const token = await SecureStore.getItemAsync(TOKEN_KEY);
      if (token) {
        try {
          const { data } = await api.get('/auth/me');
          setSesion({
            sub: data.id,
            email: data.email,
            nombre: data.nombreCompleto,
            roles: data.roles.map((r: { clave: string }) => r.clave),
          });
        } catch {
          await SecureStore.deleteItemAsync(TOKEN_KEY);
        }
      }
      setListo(true);
    })();
  }, []);

  useEffect(() => {
    let activa = true;
    (async () => {
      const cache = await SecureStore.getItemAsync(MARCA_CACHE_KEY);
      if (cache) {
        try {
          const guardada = JSON.parse(cache) as Marca;
          aplicarColores(guardada);
          if (activa) { setMarca(guardada); setMarcaLista(true); }
        } catch {
          await SecureStore.deleteItemAsync(MARCA_CACHE_KEY);
        }
      }
      try {
        const { data } = await api.get<Marca>('/configuracion/marca');
        aplicarColores(data);
        await SecureStore.setItemAsync(MARCA_CACHE_KEY, JSON.stringify(data));
        if (activa) setMarca(data);
      } catch {
        if (!cache) aplicarColores(MARCA_POR_DEFECTO);
      } finally {
        if (activa) setMarcaLista(true);
      }
    })();
    return () => { activa = false; };
  }, []);

  const iniciar = async (email: string, password: string) => {
    const { data } = await api.post('/auth/login', { email, password });
    await SecureStore.setItemAsync(TOKEN_KEY, data.accessToken);
    setSesion(data.usuario);
  };

  const cerrar = async () => {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    setSesion(null);
  };

  if (!listo || !marcaLista) return null;

  return (
    <MarcaContext.Provider value={{ marca }}>
      <SesionContext.Provider value={{ sesion, iniciar, cerrar }}>
        <NavigationContainer theme={tema}>
        <StatusBar style="light" />
        {sesion ? (
          <Tab.Navigator
            screenOptions={({ route }) => ({
              headerStyle: { backgroundColor: colores.pizarra },
              headerTintColor: '#fff',
              tabBarActiveTintColor: colores.dorado,
              tabBarInactiveTintColor: '#9FB0A9',
              tabBarStyle: { backgroundColor: colores.pizarra, borderTopColor: colores.pizarraOscuro },
              tabBarIcon: () => <Text>{iconos[route.name] ?? '•'}</Text>,
            })}
          >
            <Tab.Screen name="Inicio" component={InicioScreen} />
            <Tab.Screen name="Materias" component={MateriasScreen} />
            <Tab.Screen name="Tareas" component={TareasScreen} />
            <Tab.Screen name="Calificaciones" component={CalificacionesScreen} />
            <Tab.Screen name="Pagos" component={EstadoCuentaScreen} options={{ title: 'Estado de cuenta' }} />
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
