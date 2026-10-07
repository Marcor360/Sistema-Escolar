import axios, { AxiosError } from 'axios';
export { mensajeDeError } from './errores';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api',
  headers: { 'x-portal': 'WEB' }, withCredentials: true, timeout: 20000,
});

/** Base sin /api, para recursos públicos como el logo institucional. */
export const archivosBase = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api').replace(/\/api$/, '');

api.interceptors.request.use((config) => {
  const token = accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let accessToken: string | null = null;
let renovando: Promise<void> | null = null;
let alExpirar: (() => void) | null = null;
export function registrarSesionExpirada(handler: (() => void) | null) { alExpirar = handler; }
export function establecerToken(token: string | null) { accessToken = token; }
export async function renovarSesion() {
  const renovar = async () => { const { data } = await api.post('/auth/refresh'); accessToken = data.accessToken; };
  // La cookie es compartida entre pestañas: se serializa la rotación entre ellas.
  const serializada = async () => {
    if (navigator.locks) await navigator.locks.request('escolar-refresh', renovar);
    else await renovar();
  };
  if (!renovando) renovando = serializada().finally(() => { renovando = null; });
  return renovando;
}

api.interceptors.response.use((res) => res, async (error: AxiosError) => {
  const config = error.config;
  if (error.response?.status === 401 && config && !['/auth/login', '/auth/refresh', '/auth/forgot-password', '/auth/reset-password'].includes(config.url ?? '') && !config.headers['x-reintento-sesion']) {
    try { await renovarSesion(); config.headers['x-reintento-sesion'] = '1'; return api.request(config); }
    catch (fallo) {
      if (![401, 403].includes((fallo as AxiosError).response?.status ?? 0)) return Promise.reject(fallo);
      accessToken = null; alExpirar?.();
    }
  }
  return Promise.reject(error);
});

/** Pide un enlace firmado de corta vida y lo abre en una pestaña nueva (sin exponer /uploads). */
export async function abrirArchivo(tipo: 'materiales' | 'entregas', id: number): Promise<void> {
  const { data } = await api.get<{ url: string }>(`/archivos/${tipo}/${id}/enlace`);
  window.open(archivosBase + data.url, '_blank');
}
