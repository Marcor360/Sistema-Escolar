import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { AuthProvider, useAuth } from './AuthContext';
import { api } from '../api/client';
import { CLAVE_CIERRE, LIMITE_INACTIVIDAD_MS } from './inactividad';

function Pantalla() {
  const { sesion, cargando, logout } = useAuth();
  return <><p>{cargando ? 'Cargando' : sesion ? 'Autenticado' : 'Sesión cerrada'}</p>
    {sesion && <button onClick={() => { void logout(); }}>Cerrar</button>}</>;
}

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-14T20:00:00Z'));
  vi.spyOn(api, 'post').mockResolvedValue({ data: { accessToken: 'token-valido' } });
  vi.spyOn(api, 'get').mockResolvedValue({ data: {
    id: 1, email: 'prueba@example.invalid', nombreCompleto: 'Prueba',
    roles: [{ clave: 'ADMINISTRATIVO' }], passwordChangeRequired: false,
  } });
});
afterEach(() => {
  cleanup(); localStorage.clear(); vi.useRealTimers(); vi.restoreAllMocks();
});
async function montar() {
  render(<AuthProvider><Pantalla /></AuthProvider>);
  await act(async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); });
  expect(screen.getByText('Autenticado')).toBeTruthy();
}
it('la web cierra sesión automáticamente tras 30 minutos sin actividad', async () => {
  await montar();
  await act(async () => { await vi.advanceTimersByTimeAsync(LIMITE_INACTIVIDAD_MS); });
  expect(screen.getByText('Sesión cerrada')).toBeTruthy();
  expect(localStorage.getItem(CLAVE_CIERRE)).toBe('inactividad');
});
it('el teclado o puntero de una persona reinicia el plazo y los procesos de red no', async () => {
  await montar();
  await act(async () => { await vi.advanceTimersByTimeAsync(20 * 60000); });
  fireEvent.keyDown(window, { key: 'A' });
  await act(async () => { await vi.advanceTimersByTimeAsync(20 * 60000); });
  expect(screen.getByText('Autenticado')).toBeTruthy();
  await act(async () => { await vi.advanceTimersByTimeAsync(10 * 60000); });
  expect(screen.getByText('Sesión cerrada')).toBeTruthy();
});
it('una pestaña cerrada en otra ventana invalida esta sesión sin revivir la cookie', async () => {
  await montar();
  localStorage.setItem(CLAVE_CIERRE, 'inactividad');
  await act(async () => {
    window.dispatchEvent(new StorageEvent('storage', { key: CLAVE_CIERRE, newValue: 'inactividad' }));
  });
  expect(screen.getByText('Sesión cerrada')).toBeTruthy();
});

it('cierra localmente incluso si la revocación al servidor falla por pérdida de red', async () => {
  const fetchFallido = vi.fn().mockRejectedValue(new Error('Sin conexión'));
  vi.stubGlobal('fetch', fetchFallido);
  await montar();
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Cerrar' })); });
  expect(screen.getByText('Sesión cerrada')).toBeTruthy();
  expect(localStorage.getItem(CLAVE_CIERRE)).toBe('manual');
  expect(fetchFallido).toHaveBeenCalledOnce();
  vi.unstubAllGlobals();
});
