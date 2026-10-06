import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider, useAuth } from './AuthContext';
import { RutaProtegida } from './RutaProtegida';
import { api } from '../api/client';

function ContenidoPrueba() {
  const { cargando, errorInicio } = useAuth();
  if (cargando) return <p>Cargando sesión</p>;
  if (errorInicio) return <p>No se pudo comprobar tu sesión</p>;
  return (
    <Routes>
      <Route path="/" element={<p>Inicio autorizado</p>} />
      <Route element={<RutaProtegida roles={['FINANZAS']} />}>
        <Route path="/finanzas" element={<p>Panel financiero</p>} />
      </Route>
    </Routes>
  );
}

function mostrarRuta(roles: string[], rolesServidor = roles, error?: unknown) {
  localStorage.setItem('token', 'token-de-prueba');
  localStorage.setItem('sesion', JSON.stringify({
    sub: 1, email: 'persona@example.invalid', nombre: 'Persona', roles,
  }));
  const respuesta = vi.spyOn(api, 'get');
  if (error) respuesta.mockRejectedValue(error);
  else respuesta.mockResolvedValue({ data: {
    id: 1, email: 'persona@example.invalid', nombreCompleto: 'Persona',
    roles: rolesServidor.map((clave) => ({ clave })),
  } });
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={['/finanzas']}>
        <ContenidoPrueba />
      </MemoryRouter>
    </AuthProvider>,
  );
}

describe('RutaProtegida', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => { cleanup(); localStorage.clear(); vi.restoreAllMocks(); });

  it('deja entrar a FINANZAS en su panel', async () => {
    mostrarRuta(['FINANZAS']);
    expect(await screen.findByText('Panel financiero')).toBeTruthy();
  });

  it('redirige a quien no tiene el rol requerido', async () => {
    mostrarRuta(['MAESTRO']);
    expect(await screen.findByText('Inicio autorizado')).toBeTruthy();
    await waitFor(() => expect(screen.queryByText('Panel financiero')).toBeNull());
  });

  it('conserva acceso global para SUPERADMIN', async () => {
    mostrarRuta(['SUPERADMIN']);
    expect(await screen.findByText('Panel financiero')).toBeTruthy();
  });

  it('actualiza permisos guardados cuando cambian los roles en el servidor', async () => {
    mostrarRuta(['FINANZAS'], ['MAESTRO']);
    expect(await screen.findByText('Inicio autorizado')).toBeTruthy();
    expect(screen.queryByText('Panel financiero')).toBeNull();
    expect(JSON.parse(localStorage.getItem('sesion')!).roles).toEqual(['MAESTRO']);
  });

  it('descarta una sesión revocada al recibir 401', async () => {
    mostrarRuta(['FINANZAS'], ['FINANZAS'], { response: { status: 401 } });
    await waitFor(() => expect(localStorage.getItem('token')).toBeNull());
    expect(localStorage.getItem('sesion')).toBeNull();
    expect(screen.queryByText('Panel financiero')).toBeNull();
  });

  it('no usa roles guardados si no puede comprobar la sesión', async () => {
    mostrarRuta(['FINANZAS'], ['FINANZAS'], new Error('Red no disponible'));
    expect(await screen.findByText('No se pudo comprobar tu sesión')).toBeTruthy();
    expect(localStorage.getItem('sesion')).toBeNull();
    expect(localStorage.getItem('token')).toBe('token-de-prueba');
    expect(screen.queryByText('Panel financiero')).toBeNull();
  });
});
