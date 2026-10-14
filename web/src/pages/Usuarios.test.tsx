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
