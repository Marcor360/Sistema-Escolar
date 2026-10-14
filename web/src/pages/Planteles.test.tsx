import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { api } from '../api/client';
import PlantelesPage from './Planteles';

const contexto = vi.hoisted(() => ({ roles: ['ADMINISTRATIVO'] }));
vi.mock('../auth/AuthContext', () => ({ useAuth: () => ({ sesion: { roles: contexto.roles } }) }));
const planteles = [
  { id: 1, clave: 'A', nombre: 'Plantel A', activo: true },
  { id: 2, clave: 'B', nombre: 'Plantel B', activo: true },
];
const detalle = (id: number) => ({
  ...planteles[id - 1], conteos: { alumnos: 1, grupos: 1 }, director: null,
  personal: [{ id: 10, nombre: 'Personal QA', email: 'personal@example.test', roles: ['ADMINISTRATIVO'] }],
});
function pendiente() {
  let resolver!: (value: { data: ReturnType<typeof detalle> }) => void;
  const promesa = new Promise<{ data: ReturnType<typeof detalle> }>((resolve) => { resolver = resolve; });
  return { promesa, resolver };
}
beforeEach(() => {
  contexto.roles = ['ADMINISTRATIVO'];
  vi.spyOn(api, 'get').mockImplementation(async (url) => ({
    data: url === '/planteles' ? planteles : detalle(Number(url.split('/').pop())),
  }));
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
async function seleccionar(indice: number) {
  const listado = await screen.findByRole('region', { name: 'Listado de planteles' });
  await within(listado).findByText('Plantel A');
  fireEvent.click(screen.getAllByRole('button', { name: 'Ver detalle' })[indice]);
}

it('retira el detalle anterior durante una nueva selección e ignora respuestas tardías', async () => {
  const a = pendiente(); const b = pendiente();
  vi.mocked(api.get).mockImplementation((url) => url === '/planteles'
    ? Promise.resolve({ data: planteles }) : url === '/planteles/1' ? a.promesa : b.promesa);
  render(<PlantelesPage />);
  await seleccionar(0); await seleccionar(1);
  await act(async () => { b.resolver({ data: detalle(2) }); });
  expect(screen.getByRole('heading', { name: 'Plantel B' })).toBeTruthy();
  await act(async () => { a.resolver({ data: detalle(1) }); });
  expect(screen.queryByRole('heading', { name: 'Plantel A' })).toBeNull();
  await seleccionar(0);
  await screen.findByRole('heading', { name: 'Plantel A' });
  const nueva = pendiente();
  vi.mocked(api.get).mockReturnValue(nueva.promesa);
  await seleccionar(1);
  expect(screen.queryByRole('button', { name: 'Asignar director' })).toBeNull();
  expect(screen.getByText('Cargando detalle del plantel…')).toBeTruthy();
  await act(async () => { nueva.resolver({ data: detalle(2) }); });
  expect(screen.getByRole('heading', { name: 'Plantel B' })).toBeTruthy();
});

it('bloquea cambiar de plantel y duplicar una asignación mientras se guarda', async () => {
  const guardado = pendiente();
  const put = vi.spyOn(api, 'put').mockReturnValue(guardado.promesa);
  render(<PlantelesPage />); await seleccionar(0);
  fireEvent.change(await screen.findByLabelText('Correo del director'), { target: { value: 'director@example.test' } });
  const asignar = screen.getByRole('button', { name: 'Asignar director' });
  fireEvent.click(asignar); fireEvent.click(asignar);
  for (const boton of screen.getAllByRole('button', { name: 'Ver detalle' })) expect((boton as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getAllByRole('button', { name: 'Ver detalle' })[1]);
  expect(put).toHaveBeenCalledTimes(1);
  expect(put).toHaveBeenCalledWith('/planteles/1/director', { email: 'director@example.test' });
  await act(async () => { guardado.resolver({ data: detalle(1) }); });
  expect(screen.getByRole('heading', { name: 'Plantel A' })).toBeTruthy();
  expect((screen.getAllByRole('button', { name: 'Ver detalle' })[1] as HTMLButtonElement).disabled).toBe(false);
});

it('oculta acciones de administración para FINANZAS y conserva el directorio', async () => {
  contexto.roles = ['FINANZAS'];
  render(<PlantelesPage />); await seleccionar(0);
  await screen.findByRole('heading', { name: 'Plantel A' });
  expect(screen.queryByRole('button', { name: 'Asignar director' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Agregar' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Quitar' })).toBeNull();
  expect(within(screen.getByRole('region', { name: 'Personal del plantel' })).getByText('personal@example.test')).toBeTruthy();
});

it('permite crear y administrar planteles para SUPERADMIN', async () => {
  contexto.roles = ['SUPERADMIN'];
  render(<PlantelesPage />); await seleccionar(0);
  expect(screen.getByRole('button', { name: 'Crear' })).toBeTruthy();
  expect(await screen.findByRole('button', { name: 'Asignar director' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Quitar' })).toBeTruthy();
});

it('orienta la creación del plantel y las asignaciones pendientes', async () => {
  contexto.roles = ['SUPERADMIN'];
  render(<PlantelesPage />);
  expect(screen.getByText(/Paso 1: registra la sede/)).toBeTruthy();
  await seleccionar(0);
  expect(screen.getByRole('region', { name: 'Preparación del plantel' })).toBeTruthy();
  expect(screen.getByText(/Asigna un director cuando tengas su cuenta creada/)).toBeTruthy();
  expect(screen.getByText(/La creación del expediente del alumno no equivale/)).toBeTruthy();
});
