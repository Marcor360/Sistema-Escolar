import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { api } from '../api/client';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import DocenteFormulario from './DocenteFormulario';
import DocentesPage from './Docentes';

beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
});
function mostrar(ruta = '/docentes') {
  const router = createMemoryRouter([
    { path: '/docentes', element: <DocentesPage /> },
    { path: '/docentes/nuevo', element: <DocenteFormulario /> },
    { path: '/docentes/:id/editar', element: <DocenteFormulario /> },
  ], { initialEntries: [ruta] });
  render(<RouterProvider router={router} />);
  return router;
}
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function pendiente() {
  let resolver!: (value: { data: unknown }) => void;
  const promesa = new Promise<{ data: unknown }>((resolve) => { resolver = resolve; });
  return { promesa, resolver };
}

const docentes = [1, 2].map((id) => ({
  id,
  numEmpleado: `EMP-${id}`,
  estatus: 'ACTIVO',
  planteles: ['Centro'],
  usuario: { nombre: `Docente ${id}`, apellidoPaterno: 'Prueba', apellidoMaterno: 'Escolar', email: `docente${id}@example.test` },
}));

const respuesta = { datos: docentes, pagina: 1, porPagina: 10, total: 2 };

it('mostrar clases del segundo docente no permite que una respuesta anterior sobrescriba el detalle', async () => {
  const antigua = pendiente();
  const reciente = pendiente();
  vi.spyOn(api, 'get').mockImplementation((url) => {
    if (url === '/docentes') return Promise.resolve({ data: respuesta });
    if (url === '/planteles/mios') return Promise.resolve({ data: [{ id: 1, nombre: 'Centro' }] });
    if (url === '/docentes/1') return antigua.promesa;
    if (url === '/docentes/2') return reciente.promesa;
    throw new Error('Ruta inesperada');
  });

  mostrar();
  fireEvent.click(screen.getByRole('button', { name: /Consultar docentes/i }));
  await screen.findByText('EMP-1');
  const acciones = screen.getAllByRole('button', { name: 'Planteles y clases' });
  fireEvent.click(acciones[0]);
  expect(screen.getByText('Cargando planteles y clases del docente…')).toBeTruthy();
  fireEvent.click(acciones[1]);
  await act(async () => reciente.resolver({ data: {
    id: 2, estatus: 'ACTIVO', plantelIds: [1],
    clases: [{ id: 20, grupo: 'G2', materia: 'Segunda materia', ciclo: '2026', plantel: 'Centro', vigente: true }],
  } }));
  expect(screen.getByText(/Segunda materia/)).toBeTruthy();
  await act(async () => antigua.resolver({ data: {
    id: 1, estatus: 'ACTIVO', plantelIds: [1],
    clases: [{ id: 10, grupo: 'G1', materia: 'Materia antigua', ciclo: '2026', plantel: 'Centro', vigente: true }],
  } }));
  expect(screen.getByText(/Segunda materia/)).toBeTruthy();
  expect(screen.queryByText(/Materia antigua/)).toBeNull();
  expect(screen.queryByText('Cargando planteles y clases del docente…')).toBeNull();
});

it('no consulta el directorio completo antes de elegir una acción', async () => {
  const get = vi.spyOn(api, 'get').mockResolvedValue({ data: [] });
  mostrar();
  expect(screen.getByRole('button', { name: /Consultar docentes/i })).toBeTruthy();
  expect(get.mock.calls.filter(([ruta]) => ruta === '/docentes')).toHaveLength(0);
});


function mockDirectorio() {
  return vi.spyOn(api, 'get').mockImplementation(async (url, config) => ({ data:
    url === '/planteles/mios' ? [{ id: 1, nombre: 'Centro' }] :
    url === '/docentes/1' ? docentes[0] :
    { ...respuesta, pagina: (config?.params as { pagina?: number } | undefined)?.pagina || 1, total: 115 },
  }));
}

it('editar usa ruta propia y cancelar restaura página, filtro y búsqueda', async () => {
  const get = mockDirectorio();
  const router = mostrar('/docentes?vista=consulta&plantel=1&buscar=Prueba&pagina=2');
  fireEvent.click((await screen.findAllByRole('button', { name: 'Editar' }))[0]);
  await screen.findByRole('heading', { name: 'Editar docente' });
  await waitFor(() => expect((screen.getByLabelText('Nombre *') as HTMLInputElement).value).toBe('Docente 1'));
  expect(screen.queryByRole('region', { name: 'Listado de docentes' })).toBeNull();
  expect(router.state.location.pathname).toBe('/docentes/1/editar');
  fireEvent.click(screen.getByRole('button', { name: 'Cancelar y volver' }));
  await screen.findByRole('heading', { name: 'Directorio de docentes' });
  expect(router.state.location.search).toContain('pagina=2');
  expect((screen.getByLabelText('Buscar docentes') as HTMLInputElement).value).toBe('Prueba');
  await waitFor(() => expect(get).toHaveBeenLastCalledWith('/docentes', expect.objectContaining({ params: { pagina: 2, plantelId: '1', porPagina: 10, buscar: 'Prueba' } })));
});

it('avisa por planteles sin guardar y permite cancelar o confirmar la salida', async () => {
  mockDirectorio();
  const router = mostrar('/docentes/nuevo');
  fireEvent.click(await screen.findByLabelText('Centro'));
  fireEvent.click(screen.getByRole('button', { name: 'Cancelar y volver' }));
  await screen.findByRole('dialog');
  fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
  expect(router.state.location.pathname).toBe('/docentes/nuevo');
  expect((screen.getByLabelText('Centro') as HTMLInputElement).checked).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Cancelar y volver' }));
  await screen.findByRole('dialog');
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
  await screen.findByRole('button', { name: /Consultar docentes/ });
});

it('protege atrás del navegador y recarga con datos sin guardar', async () => {
  mockDirectorio();
  const router = mostrar();
  fireEvent.click(screen.getByRole('button', { name: /Registrar docente/ }));
  await screen.findByLabelText('Centro');
  fireEvent.change(screen.getByLabelText('Nombre *'), { target: { value: 'Cambio pendiente' } });
  const evento = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(evento);
  expect(evento.defaultPrevented).toBe(true);
  await act(async () => { void router.navigate(-1); });
  await screen.findByRole('dialog');
  fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
  expect((screen.getByLabelText('Nombre *') as HTMLInputElement).value).toBe('Cambio pendiente');
});

it('preserva cambios tras error, evita doble envío y retorna al listado tras guardar', async () => {
  mockDirectorio();
  const patch = vi.spyOn(api, 'patch').mockRejectedValueOnce({ response: { data: { message: 'No disponible' } } }).mockResolvedValue({ data: {} });
  const router = mostrar('/docentes/1/editar?vista=consulta&plantel=1&pagina=2');
  await waitFor(() => expect((screen.getByLabelText('Nombre *') as HTMLInputElement).value).toBe('Docente 1'));
  const nombre = screen.getByLabelText('Nombre *');
  fireEvent.change(nombre, { target: { value: 'Nombre nuevo' } });
  const form = nombre.closest('form')!;
  fireEvent.submit(form); fireEvent.submit(form);
  expect(patch).toHaveBeenCalledTimes(1);
  await screen.findByRole('alert');
  expect((nombre as HTMLInputElement).value).toBe('Nombre nuevo');
  fireEvent.submit(form);
  await screen.findByText('Docente actualizado');
  expect(router.state.location.search).toContain('pagina=2');
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(patch).toHaveBeenLastCalledWith('/docentes/1', expect.objectContaining({ nombre: 'Nombre nuevo' }));
});

it('muestra segundo nombre opcional y ambos apellidos requeridos para docentes', async () => {
  vi.spyOn(api, 'get').mockResolvedValue({ data: [{ id: 1, nombre: 'Centro' }] });
  mostrar('/docentes/nuevo');
  const segundo = await screen.findByLabelText('Segundo nombre (opcional)') as HTMLInputElement;
  expect(segundo.required).toBe(false);
  expect((screen.getByLabelText('Segundo apellido *') as HTMLInputElement).required).toBe(true);
  const ids = [...document.querySelectorAll<HTMLInputElement>('#form-docente input')].map(campo => campo.id);
  expect(ids.indexOf('doc-nombre')).toBeLessThan(ids.indexOf('doc-segundo-nombre'));
  expect(ids.indexOf('doc-segundo-nombre')).toBeLessThan(ids.indexOf('doc-paterno'));
  expect(ids.indexOf('doc-paterno')).toBeLessThan(ids.indexOf('doc-materno'));
  expect(ids.indexOf('doc-materno')).toBeLessThan(ids.indexOf('doc-email'));
});
