import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AuthProvider, useAuth } from './AuthContext';
import { RutaProtegida } from './RutaProtegida';

function ContenidoPrueba() {
  const { cargando } = useAuth();
  if (cargando) return <p>Cargando sesión</p>;
  return (
    <Routes>
      <Route path="/" element={<p>Inicio autorizado</p>} />
      <Route element={<RutaProtegida roles={['FINANZAS']} />}>
        <Route path="/finanzas" element={<p>Panel financiero</p>} />
      </Route>
    </Routes>
  );
}

function mostrarRuta(roles: string[]) {
  localStorage.setItem('token', 'token-de-prueba');
  localStorage.setItem('sesion', JSON.stringify({
    sub: 1, email: 'persona@example.invalid', nombre: 'Persona', roles,
  }));
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
  afterEach(() => { cleanup(); localStorage.clear(); });

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
});
