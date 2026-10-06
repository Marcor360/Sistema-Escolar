import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import { resolverApiUrl } from './config';
export { mensajeDeError } from './errores';

const baseURL = resolverApiUrl(
  String(Constants.expoConfig?.extra?.appEnv || 'development'),
  Constants.expoConfig?.extra?.apiUrl as string | undefined,
);

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
