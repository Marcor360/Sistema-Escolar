import axios from 'axios';
export { mensajeDeError } from './errores';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api',
  headers: { 'x-portal': 'WEB' },
});

/** Base sin /api, para recursos públicos como el logo institucional. */
export const archivosBase = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api').replace(/\/api$/, '');

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401 && !location.pathname.startsWith('/login')) {
      localStorage.removeItem('token');
      localStorage.removeItem('sesion');
      location.href = '/login';
    }
    return Promise.reject(error);
  },
);

/** Pide un enlace firmado de corta vida y lo abre en una pestaña nueva (sin exponer /uploads). */
export async function abrirArchivo(tipo: 'materiales' | 'entregas', id: number): Promise<void> {
  const { data } = await api.get<{ url: string }>(`/archivos/${tipo}/${id}/enlace`);
  window.open(archivosBase + data.url, '_blank');
}
