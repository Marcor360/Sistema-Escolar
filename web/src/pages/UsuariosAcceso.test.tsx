import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import { api } from '../api/client';
import { ModuloTrabajo } from '../components/ModuloTrabajo';
import UsuariosPage from './Usuarios';
vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({ sesion: { roles: ['SUPERADMIN'] }, tieneRol: () => true }),
}));
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
function montar() {
  const get = vi
    .spyOn(api, 'get')
    .mockImplementation(async (ruta) => ({
      data:
        ruta === '/planteles/mios'
          ? [{ id: 4, nombre: 'Centro' }]
          : {
              datos: [{ id: 8, usuarioId: 18, nombre: 'Alumna QA', correo: 'qa@example.invalid', estatus: 'ACTIVO' }],
              total: 1,
              pagina: 1,
              porPagina: 10,
            },
    }));
  render(
    <MemoryRouter initialEntries={['/usuarios?vista=consulta&tipo=ALUMNO&activacionPendiente=true&plantel=4']}>
      <ModuloTrabajo
        titulo="Usuarios"
        acciones={[{ titulo: 'Consultar usuarios', detalle: 'Consultar', vista: 'consulta' }]}
      >
        <UsuariosPage />
      </ModuloTrabajo>
    </MemoryRouter>,
  );
  return get;
}
it('el enlace de Seguimiento consulta activaciones pendientes del plantel y conserva el filtro al buscar', async () => {
  const get = montar();
  await screen.findByText('Alumna QA');
  expect((screen.getByLabelText('Mostrar alumnos con activación pendiente') as HTMLInputElement).checked).toBe(true);
  expect(get).toHaveBeenCalledWith('/usuarios/listado', {
    params: expect.objectContaining({ activacionPendiente: 'true', plantelId: '4', tipo: 'ALUMNO' }),
  });
  fireEvent.change(screen.getByLabelText('Buscar', { exact: true }), { target: { value: 'QA' } });
  fireEvent.click(screen.getByRole('button', { name: 'Aplicar' }));
  await waitFor(() =>
    expect(get).toHaveBeenCalledWith('/usuarios/listado', {
      params: expect.objectContaining({ activacionPendiente: 'true', buscar: 'QA', plantelId: '4' }),
    }),
  );
});
it('cambiar a alumnos sin correo elimina el filtro incompatible de activación', async () => {
  const get = montar();
  await screen.findByText('Alumna QA');
  fireEvent.click(screen.getByLabelText('Mostrar alumnos sin correo institucional'));
  await waitFor(() =>
    expect((screen.getByLabelText('Mostrar alumnos con activación pendiente') as HTMLInputElement).checked).toBe(false),
  );
  expect(get.mock.calls.filter((c) => c[0] === '/usuarios/listado').slice(-1)[0]?.[1]?.params).toMatchObject({
    sinCorreo: 'true',
    plantelId: '4',
  });
  expect(get.mock.calls.filter((c) => c[0] === '/usuarios/listado').slice(-1)[0]?.[1]?.params).not.toHaveProperty(
    'activacionPendiente',
  );
});
