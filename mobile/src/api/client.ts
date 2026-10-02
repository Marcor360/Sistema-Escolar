import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
export { mensajeDeError } from './errores';

const baseURL =
  process.env.EXPO_PUBLIC_API_URL ||
  (Constants.expoConfig?.extra?.apiUrl as string) ||
  'http://localhost:3000/api';

export const api = axios.create({ baseURL, timeout: 20000, headers: { 'x-portal': 'MOVIL' } });

export const TOKEN_KEY = 'escolar_token';
let alExpirarSesion: (() => void) | null = null;

export function registrarSesionExpirada(handler: (() => void) | null) {
  alExpirarSesion = handler;
}

api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      await SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => undefined);
      alExpirarSesion?.();
    }
    return Promise.reject(error);
  },
);

/** Base sin /api, para abrir archivos servidos en /uploads. */
export const archivosBase = baseURL.replace(/\/api$/, '');
