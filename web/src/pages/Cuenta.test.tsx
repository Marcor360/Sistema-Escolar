import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import { api } from '../api/client';
import CuentaPage from './Cuenta';

const finalizar = vi.hoisted(() => vi.fn());
vi.mock('../auth/AuthContext', () => ({ useAuth: () => ({
  sesion: { nombre: 'Alumno de prueba', email: 'test@escuela.example', roles: ['ADMINISTRATIVO'] },
  finalizarSesionLocal: finalizar,
}) }));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  finalizar.mockReset();
});

function LoginPrueba() {
  const location = useLocation();
  const estado = location.state as { aviso?: string } | null;
  return <p role="status">{estado?.aviso ?? 'Inicio de sesión'}</p>;
}

function montar() {
  render(<MemoryRouter initialEntries={['/cuenta']}>
    <Routes>
      <Route path="/cuenta" element={<CuentaPage />} />
      <Route path="/login" element={<LoginPrueba />} />
    </Routes>
  </MemoryRouter>);
}

function capturar(actual = 'anterior123', nueva = 'nuevaPassword2026', confirmar = nueva) {
  fireEvent.change(screen.getByLabelText('Contraseña actual'), { target: { value: actual } });
  fireEvent.change(screen.getByLabelText('Nueva contraseña (mínimo 8 caracteres)'), { target: { value: nueva } });
  fireEvent.change(screen.getByLabelText('Confirmar nueva contraseña'), { target: { value: confirmar } });
}

it('después del cambio de contraseña cierra sesión local y redirige al login', async () => {
  const post = vi.spyOn(api, 'post').mockResolvedValue({ data: { mensaje: 'Contraseña actualizada' } });
  montar();
  capturar();
  fireEvent.click(screen.getByRole('button', { name: 'Actualizar contraseña' }));
  await screen.findByText('Contraseña actualizada. Por seguridad, vuelve a iniciar sesión.');
  expect(post).toHaveBeenCalledOnce();
  expect(post).toHaveBeenCalledWith('/auth/cambiar-password', { actual: 'anterior123', nueva: 'nuevaPassword2026' });
  expect(finalizar).toHaveBeenCalledOnce();
});

it('impide una confirmación distinta sin llamar al backend', () => {
  const post = vi.spyOn(api, 'post').mockResolvedValue({ data: {} });
  montar();
  capturar('anterior123', 'nuevaPassword2026', 'no-coincide');
  fireEvent.click(screen.getByRole('button', { name: 'Actualizar contraseña' }));
  expect(screen.getByRole('alert').textContent).toContain('no coincide');
  expect(post).not.toHaveBeenCalled();
  expect(finalizar).not.toHaveBeenCalled();
});

it('bloquea doble envío mientras espera la API y conserva los datos si falla', async () => {
  let rechazar!: (error: Error) => void;
  const post = vi.spyOn(api, 'post').mockImplementation(() =>
    new Promise((_, reject) => { rechazar = reject; }));
  montar();
  capturar();
  fireEvent.click(screen.getByRole('button', { name: 'Actualizar contraseña' }));
  expect((screen.getByRole('button', { name: 'Actualizando…' }) as HTMLButtonElement).disabled).toBe(true);
  expect(post).toHaveBeenCalledOnce();
  rechazar(Object.assign(new Error('Falló la solicitud'), { response: { data: { message: 'Servicio no disponible' } } }));
  await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Servicio no disponible'));
  expect((screen.getByLabelText('Contraseña actual') as HTMLInputElement).value).toBe('anterior123');
  expect((screen.getByRole('button', { name: 'Actualizar contraseña' }) as HTMLButtonElement).disabled).toBe(false);
  expect(finalizar).not.toHaveBeenCalled();
});

it('muestra datos existentes de /auth/me sin permitir editarlos en cliente', async () => {
  vi.spyOn(api, 'get').mockResolvedValue({ data: {
    id: 42, nombreCompleto: 'Personal Institucional', email: 'test@escuela.example',
    telefono: '5512345678', activo: true, passwordChangeRequired: false,
    roles: [{ clave: 'ADMINISTRATIVO', nombre: 'Administrativo' }],
  } });
  montar();
  expect(await screen.findByText('Personal Institucional')).toBeTruthy();
  expect(screen.getByText('5512345678')).toBeTruthy();
  expect(screen.getByText('Administrativo')).toBeTruthy();
  expect(screen.getByText('Activa')).toBeTruthy();
});
