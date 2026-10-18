import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import CatalogosAcademicosPage from './CatalogosAcademicos';
import { api } from '../api/client';
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
function montar(ruta: string) {
  const router = createMemoryRouter([{ path: '/catalogos-academicos', element: <CatalogosAcademicosPage /> }, { path: '/catalogos-academicos/:tipo/:id', element: <CatalogosAcademicosPage /> }], { initialEntries: [ruta] });
  render(<RouterProvider router={router} />); return router;
}
it('el panel carga catálogos solo al elegir una acción y pide diez por página', async () => {
  const get = vi.spyOn(api, 'get').mockImplementation(async (ruta) => ({ data: ruta === '/planteles/mios' ? [] : { datos: [], total: 0 } }));
  montar('/catalogos-academicos');
  expect(get.mock.calls.some(([ruta]) => ruta === '/academico/catalogos/niveles')).toBe(false);
  fireEvent.click(screen.getByRole('button', { name: /Niveles académicos/ }));
  await screen.findByText(/Sin registros/);
  expect(get).toHaveBeenCalledWith('/academico/catalogos/niveles', expect.objectContaining({ params: expect.objectContaining({ pagina: 1, porPagina: 10 }) }));
});
it('cambiar plantel limpia dependencias sin borrar nombre ni versión del plan', async () => {
  vi.spyOn(api, 'get').mockImplementation(async (ruta) => ({ data: ruta === '/planteles/mios' ? [{ id: 1, nombre: 'Centro' }, { id: 2, nombre: 'Norte' }] : ruta === '/academico/ciclos' ? [] : { datos: [{ id: 4, nombre: 'Nivel' }], total: 1 } }));
  montar('/catalogos-academicos/carreras/nuevo');
  const nombre = await screen.findByLabelText('Nombre');
  fireEvent.change(nombre, { target: { value: 'Ingeniería' } });
  fireEvent.change(screen.getByLabelText('Versión del plan'), { target: { value: '2026' } });
  fireEvent.change(screen.getByLabelText('Plantel'), { target: { value: '1' } });
  await screen.findByRole('option', { name: 'Nivel' });
  fireEvent.change(screen.getByLabelText('Nivel', { selector: 'select' }), { target: { value: '4' } });
  fireEvent.change(screen.getByLabelText('Plantel'), { target: { value: '2' } });
  expect((nombre as HTMLInputElement).value).toBe('Ingeniería');
  expect((screen.getByLabelText('Versión del plan') as HTMLInputElement).value).toBe('2026');
  expect((screen.getByLabelText('Nivel', { selector: 'select' }) as HTMLSelectElement).value).toBe('');
});
it('conserva datos tras fallo y guarda un nivel configurable sin datos inventados', async () => {
  vi.spyOn(api, 'get').mockImplementation(async (ruta) => ({ data: ruta === '/planteles/mios' ? [{ id: 1, nombre: 'Centro' }] : ruta === '/academico/ciclos' ? [] : { datos: [], total: 0 } }));
  const post = vi.spyOn(api, 'post').mockRejectedValueOnce({ response: { data: { message: 'Temporal' } } }).mockResolvedValue({ data: {} });
  const router = montar('/catalogos-academicos/niveles/nuevo');
  fireEvent.change(await screen.findByLabelText('Clave'), { target: { value: 'LIC' } });
  fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Licenciatura' } });
  fireEvent.change(screen.getByLabelText('Plantel'), { target: { value: '1' } });
  fireEvent.submit(screen.getByLabelText('Clave').closest('form')!);
  await screen.findByRole('alert');
  expect((screen.getByLabelText('Nombre') as HTMLInputElement).value).toBe('Licenciatura');
  fireEvent.submit(screen.getByLabelText('Clave').closest('form')!);
  await waitFor(() => expect(router.state.location.pathname).toBe('/catalogos-academicos'));
  expect(post).toHaveBeenLastCalledWith('/academico/catalogos/niveles', { clave: 'LIC', nombre: 'Licenciatura', plantelId: 1 });
});
