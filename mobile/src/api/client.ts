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
export const REFRESH_KEY = 'escolar_refresh';
let renovando: Promise<void> | null = null;
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
    if (error.response?.status === 401 && (!error.config?.url?.startsWith('/auth/') || error.config?.url === '/auth/me') && !error.config?.headers['x-reintento-sesion']) {
      try {
        if (!renovando) renovando = (async () => {
          const refreshToken = await SecureStore.getItemAsync(REFRESH_KEY);
          if (!refreshToken) throw new Error('Sin refresh');
          const { data } = await axios.post(`${baseURL}/auth/refresh`, { refreshToken }, { timeout: 20000, headers: { 'x-portal': 'MOVIL' } });
          await SecureStore.setItemAsync(REFRESH_KEY, data.refreshToken);
          await SecureStore.setItemAsync(TOKEN_KEY, data.accessToken);
        })().finally(() => { renovando = null; });
        await renovando;
        error.config.headers['x-reintento-sesion'] = '1';
        return api.request(error.config);
      } catch (refreshError) {
        const status = (refreshError as { response?: { status?: number } }).response?.status;
        if (![401, 403].includes(status ?? 0) && (refreshError as Error).message !== 'Sin refresh') return Promise.reject(refreshError);
      }
      await SecureStore.deleteItemAsync(REFRESH_KEY).catch(() => undefined);
      await SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => undefined);
      alExpirarSesion?.();
    }
    return Promise.reject(error);
  },
);

/** Base sin /api, para enlaces firmados de archivos y recursos públicos de marca. */
export const archivosBase = baseURL.replace(/\/api$/, '');
