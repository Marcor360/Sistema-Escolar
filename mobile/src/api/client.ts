import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';

const baseURL =
  process.env.EXPO_PUBLIC_API_URL ||
  (Constants.expoConfig?.extra?.apiUrl as string) ||
  'http://localhost:3000/api';

export const api = axios.create({ baseURL });

export const TOKEN_KEY = 'escolar_token';

api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export function mensajeDeError(error: unknown): string {
  const data = (error as { response?: { data?: { message?: string | string[] } } }).response?.data;
  if (Array.isArray(data?.message)) return data.message.join(', ');
  return data?.message || 'Ocurrió un error inesperado';
}

/** Base sin /api, para abrir archivos servidos en /uploads. */
export const archivosBase = baseURL.replace(/\/api$/, '');
