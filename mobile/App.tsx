import { useCallback, useEffect, useMemo, useState } from 'react';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, Text, TextInput, TouchableOpacity, View } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { api, mensajeDeError, registrarSesionExpirada, TOKEN_KEY, REFRESH_KEY } from './src/api/client';
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
  const [errorInicio, setErrorInicio] = useState('');
  const [actual, setActual] = useState(''); const [nueva, setNueva] = useState('');
  const [errorPassword, setErrorPassword] = useState(''); const [cambiando, setCambiando] = useState(false);

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

  const restaurarSesion = useCallback(async () => {
    setListo(false);
    setErrorInicio('');
    try {
      const token = await SecureStore.getItemAsync(TOKEN_KEY);
      if (token) {
        try {
          const { data } = await api.get('/auth/me');
          setSesion({
            sub: data.id,
            email: data.email,
            nombre: data.nombreCompleto,
            roles: data.roles.map((r: { clave: string }) => r.clave), passwordChangeRequired: data.passwordChangeRequired,
          });
        } catch (error) {
          if ((error as { response?: { status?: number } }).response?.status !== 401) {
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

  useEffect(() => { void restaurarSesion(); }, [restaurarSesion]);

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

  useEffect(() => {
    registrarSesionExpirada(() => setSesion(null));
    return () => registrarSesionExpirada(null);
  }, []);

  const iniciar = async (email: string, password: string) => {
    const { data } = await api.post('/auth/login', { email, password });
    await SecureStore.setItemAsync(REFRESH_KEY, data.refreshToken);
    await SecureStore.setItemAsync(TOKEN_KEY, data.accessToken);
    setSesion(data.usuario);
  };

  const cerrar = async () => {
    await api.post('/auth/logout');
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    await SecureStore.deleteItemAsync(REFRESH_KEY);
    setSesion(null);
  };

  if (!listo || !marcaLista) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colores.papel }}>
        <ActivityIndicator color={marca.colorPrimario} accessibilityLabel="Cargando aplicación" />
      </View>
    );
  }

  if (sesion?.passwordChangeRequired) return <View style={{ padding: 24, paddingTop: 60 }}>
    <Text accessibilityRole="header">Cambia tu contraseña temporal</Text>
    <TextInput accessibilityLabel="Contraseña temporal" placeholder="Contraseña temporal" secureTextEntry value={actual} onChangeText={setActual} />
    <TextInput accessibilityLabel="Nueva contraseña" placeholder="Nueva contraseña (mínimo 8 caracteres)" secureTextEntry value={nueva} onChangeText={setNueva} />
    {errorPassword !== '' && <Text accessibilityRole="alert">{errorPassword}</Text>}
    <TouchableOpacity accessibilityRole="button" disabled={cambiando || nueva.length < 8} onPress={async () => {
      setCambiando(true); setErrorPassword('');
      try { await api.post('/auth/cambiar-password', { actual, nueva });
        await SecureStore.deleteItemAsync(TOKEN_KEY); await SecureStore.deleteItemAsync(REFRESH_KEY);
        setSesion(null); setActual(''); setNueva('');
      } catch (err) { setErrorPassword(mensajeDeError(err)); } finally { setCambiando(false); }
    }}><Text>{cambiando ? 'Guardando…' : 'Cambiar contraseña y volver a ingresar'}</Text></TouchableOpacity>
  </View>;

  if (errorInicio) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: colores.papel }}>
        <Text accessibilityRole="alert" style={{ color: colores.peligro, textAlign: 'center', marginBottom: 16 }}>
          No se pudo comprobar tu sesión. {errorInicio}
        </Text>
        <TouchableOpacity
          onPress={() => { void restaurarSesion(); }} accessibilityRole="button" accessibilityLabel="Reintentar sesión"
          style={{ backgroundColor: marca.colorPrimario, padding: 14 }}
        >
          <Text style={{ color: '#fff' }}>Reintentar</Text>
        </TouchableOpacity>
      </View>
    );
  }

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
