import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ secure: { getItemAsync: vi.fn(), setItemAsync: vi.fn(), deleteItemAsync: vi.fn() } }));
vi.mock('expo-secure-store', () => mocks.secure);
vi.mock('expo-constants', () => ({ default: { expoConfig: { extra: { appEnv: 'development', apiUrl: 'http://localhost:3000/api' } } } }));
import axios, { AxiosError, AxiosHeaders } from 'axios';
import { api, registrarSesionExpirada } from './client';
beforeEach(() => { vi.restoreAllMocks(); vi.clearAllMocks(); mocks.secure.getItemAsync.mockResolvedValue('refresh-local'); mocks.secure.deleteItemAsync.mockResolvedValue(undefined); registrarSesionExpirada(null); });
const respuesta = (status: number) => {
  const config = { url: '/auth/me', headers: new AxiosHeaders() };
  return new AxiosError('Error HTTP', 'ERR_BAD_RESPONSE', config, undefined, { status, data: {}, headers: {}, config, statusText: 'Error' });
};
it.each([429, 500, 503])('conserva SecureStore y sesión ante fallo temporal %s del refresh', async (status) => {
  const fallo = respuesta(status); const expirada = vi.fn(); registrarSesionExpirada(expirada);
  vi.spyOn(axios, 'post').mockRejectedValue(fallo);
  api.defaults.adapter = async () => { throw respuesta(401); };
  await expect(api.get('/auth/me')).rejects.toBe(fallo);
  expect(mocks.secure.deleteItemAsync).not.toHaveBeenCalled(); expect(expirada).not.toHaveBeenCalled();
});
it.each([401, 403])('elimina tokens y avisa cuando el refresh es rechazado con %s', async (status) => {
  const expirada = vi.fn(); registrarSesionExpirada(expirada); vi.spyOn(axios, 'post').mockRejectedValue(respuesta(status));
  api.defaults.adapter = async () => { throw respuesta(401); };
  await expect(api.get('/auth/me')).rejects.toHaveProperty('response.status', 401);
  expect(mocks.secure.deleteItemAsync).toHaveBeenCalledWith('escolar_refresh'); expect(mocks.secure.deleteItemAsync).toHaveBeenCalledWith('escolar_token'); expect(expirada).toHaveBeenCalledOnce();
});
