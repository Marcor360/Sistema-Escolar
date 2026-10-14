import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { api } from '../api/client';
import UsuariosPage from './Usuarios';

vi.mock('../auth/AuthContext', () => ({ useAuth: () => ({
  sesion: { roles: ['SUPERADMIN'] },
}) }));
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it('presenta cuentas en una tabla semántica adaptable con etiquetas por dato', async () => {
  vi.spyOn(api, 'get').mockImplementation(async (url) => ({
    data: url === '/planteles/mios' ? [{ id: 1, nombre: 'Centro' }]
      : { datos: [{ id: 9, matricula: 'AL9', nombre: 'Alumna QA', correo: 'qa@example.test',
        plantel: 'Centro', estatus: 'ACTIVO' }], total: 1, pagina: 1, porPagina: 20 },
  }));
  render(<UsuariosPage />);
  await waitFor(() => expect(screen.getByText('Alumna QA')).toBeTruthy());
  const region = screen.getByRole('region', { name: 'Listado de usuarios' });
  const tabla = region.querySelector('table');
  expect(tabla?.classList.contains('tabla-adaptable')).toBe(true);
  expect(region.querySelector('[data-etiqueta="Correo"]')?.textContent).toBe('qa@example.test');
  expect(screen.getByRole('button', { name: 'Crear' })).toBeTruthy();
});

it('lleva el foco al formulario después de cargar una corrección de personal', async () => {
  const { fireEvent } = await import('@testing-library/react');
  vi.spyOn(api, 'get').mockImplementation(async (url) => ({ data:
    url === '/planteles/mios' ? [{ id: 1, nombre: 'Centro' }]
      : url === '/usuarios/9/personal' ? { id: 9, activo: true, plantelIds: [1], roles: [{ clave: 'ADMINISTRATIVO' }], nombre: 'Personal', apellidoPaterno: 'Prueba', email: 'personal@example.test' }
        : { datos: [{ id: 9, nombre: 'Personal Prueba', correo: 'personal@example.test', roles: ['ADMINISTRATIVO'], planteles: ['Centro'], activo: true }], total: 1, pagina: 1, porPagina: 20 },
  }));
  render(<UsuariosPage />);
  await screen.findByText('Personal Prueba');
  fireEvent.click(screen.getByRole('button', { name: 'Personal' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Corregir cuenta' }));
  const titulo = await screen.findByRole('heading', { name: 'Corregir cuenta de personal' });
  await waitFor(() => expect(document.activeElement).toBe(titulo));
  expect((screen.getByLabelText('Nombre') as HTMLInputElement).value).toBe('Personal');
});
