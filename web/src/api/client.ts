import axios from 'axios';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api',
});

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

/** Extrae un mensaje legible de un error de la API. */
export function mensajeDeError(error: unknown): string {
  const data = (error as { response?: { data?: { message?: string | string[] } } }).response?.data;
  if (Array.isArray(data?.message)) return data.message.join(', ');
  return data?.message || 'Ocurrió un error inesperado';
}
