import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { api } from '../api/client';
import GruposPage from './Grupos';
import type { Grupo } from '../features/grupos/tipos';

vi.mock('../components/SelectorBuscable', () => ({ SelectorBuscable: ({ etiqueta, valor, cambiar }: {
  etiqueta: string; valor: string; cambiar: (value: string) => void;
}) => <label>{etiqueta}<select value={valor} onChange={(e) => cambiar(e.target.value)}>
  <option value="">Selecciona…</option><option value="9">Persona QA</option></select></label> }));
const ciclos = [{ id: 1, clave: '2026', activo: true, estado: 'VIGENTE' },
  { id: 2, clave: '2027', activo: false, estado: 'PREPARACION' }];
const grupos: Grupo[] = [1, 2].map((id) => ({ id, nombre: `Grupo ${id}`, ciclo: ciclos[0],
  plantel: { id, nombre: `Plantel ${id}` } }));
const resultado = (nombre = 'Grupo 1', pagina = 1) => ({ datos: [{ ...grupos[0], nombre }], total: 40, pagina, porPagina: 20 });
function pendiente() {
  let resolver!: (value: { data: unknown }) => void;
  let rechazar!: (error: Error) => void;
  const promesa = new Promise<{ data: unknown }>((resolve, reject) => { resolver = resolve; rechazar = reject; });
  return { promesa, resolver, rechazar };
}
function datos(url: string) {
  if (url === '/academico/ciclos') return ciclos;
  if (url === '/planteles/mios') return grupos.map((g) => g.plantel);
  if (url === '/academico/materias') return [{ id: 1, clave: 'MAT', nombre: 'Materia QA' }];
  if (url === '/academico/grupos') return { ...resultado(), datos: grupos };
  return [];
}
beforeEach(() => { vi.spyOn(api, 'get').mockImplementation(async (url) => ({ data: datos(url) })); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
async function administrar(indice: number) {
  const listado = screen.getByRole('region', { name: 'Listado de grupos' });
  fireEvent.click((await within(listado).findAllByRole('button', { name: 'Administrar' }))[indice]);
}

it('paginar no recarga catálogos y conserva el filtro aplicado aunque se edite el selector', async () => {
  render(<GruposPage />); await screen.findByText('Grupo 1');
  const filtro = screen.getByLabelText('Filtrar por plantel');
  fireEvent.change(filtro, { target: { value: '1' } });
  fireEvent.click(screen.getByRole('button', { name: 'Aplicar' }));
  await waitFor(() => expect(api.get).toHaveBeenLastCalledWith('/academico/grupos', { params: { pagina: 1, plantelId: '1' } }));
  fireEvent.change(filtro, { target: { value: '2' } });
  fireEvent.click(screen.getByRole('button', { name: 'Ir a la página siguiente' }));
  await waitFor(() => expect(api.get).toHaveBeenLastCalledWith('/academico/grupos', { params: { pagina: 2, plantelId: '1' } }));
  for (const url of ['/academico/ciclos', '/planteles/mios', '/academico/materias'])
    expect(vi.mocked(api.get).mock.calls.filter(([ruta]) => ruta === url)).toHaveLength(1);
});

it('un error de catálogos permanece visible y permite recuperar los tres catálogos', async () => {
  vi.mocked(api.get).mockImplementation(async (url) => {
    if (url === '/academico/ciclos') throw new Error('Sin catálogos');
    return { data: datos(url) };
  });
  render(<GruposPage />); await screen.findByRole('alert');
  fireEvent.click(screen.getByRole('button', { name: 'Aplicar' }));
  expect(screen.getByRole('alert')).toBeTruthy();
  vi.mocked(api.get).mockImplementation(async (url) => ({ data: datos(url) }));
  fireEvent.click(screen.getByRole('button', { name: 'Reintentar catálogos' }));
  await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
  expect(within(screen.getByLabelText('Consultar ciclo')).getByText('2027 · PREPARACION')).toBeTruthy();
});

it('descarta el listado y error anteriores al cambiar rápidamente de ciclo', async () => {
  const anterior = pendiente(); const reciente = pendiente();
  vi.mocked(api.get).mockImplementation((url, config) => url !== '/academico/grupos'
    ? Promise.resolve({ data: datos(url) })
    : (config?.params as { cicloId?: string })?.cicloId === '2' ? reciente.promesa : anterior.promesa);
  render(<GruposPage />);
  await screen.findByRole('option', { name: '2027 · PREPARACION' });
  fireEvent.change(screen.getByLabelText('Consultar ciclo'), { target: { value: '2' } });
  await act(async () => { reciente.resolver({ data: resultado('Grupo reciente') }); });
  await act(async () => { anterior.rechazar(new Error('Error antiguo')); });
  expect(screen.getByText('Grupo reciente')).toBeTruthy();
  expect(screen.queryByRole('alert')).toBeNull();
  expect(screen.getByRole('table').getAttribute('aria-busy')).toBe('false');
});

it('la selección nueva descarta el detalle anterior y limpia selecciones de asignación', async () => {
  render(<GruposPage />); await screen.findByText('Grupo 1');
  await administrar(0); await screen.findByRole('button', { name: 'Asignar materia' });
  fireEvent.change(screen.getByLabelText('Materia'), { target: { value: '1' } });
  fireEvent.change(screen.getByLabelText('Docente'), { target: { value: '9' } });
  const lento = pendiente(); const actual = pendiente();
  vi.mocked(api.get).mockImplementation((url) => url.includes('/grupos/1/') ? lento.promesa : actual.promesa);
  await administrar(0);
  expect(screen.queryByRole('button', { name: 'Asignar materia' })).toBeNull();
  await administrar(1);
  await act(async () => { actual.resolver({ data: [] }); });
  await act(async () => { lento.rechazar(new Error('Detalle antiguo')); });
  expect(screen.getByRole('heading', { name: /Materias del grupo Grupo 2/ })).toBeTruthy();
  expect((screen.getByLabelText('Materia') as HTMLSelectElement).value).toBe('');
  expect((screen.getByLabelText('Docente') as HTMLSelectElement).value).toBe('');
  expect(screen.queryByRole('alert')).toBeNull();
});

it('un error de detalle no se presenta como grupo vacío y ofrece reintento', async () => {
  render(<GruposPage />); await screen.findByText('Grupo 1');
  vi.mocked(api.get).mockRejectedValue(new Error('Detalle no disponible'));
  await administrar(0); await screen.findByRole('button', { name: 'Reintentar detalle del grupo' });
  expect(screen.queryByText('Sin materias asignadas.')).toBeNull();
  vi.mocked(api.get).mockResolvedValue({ data: [] });
  fireEvent.click(screen.getByRole('button', { name: 'Reintentar detalle del grupo' }));
  await screen.findByText('Sin materias asignadas.');
  expect(screen.queryByRole('alert')).toBeNull();
});

it('explica el orden de preparación académica antes de crear grupos', async () => {
  render(<GruposPage />);
  expect(screen.getByText(/Orden recomendado: prepara el ciclo y las materias/)).toBeTruthy();
  await screen.findByRole('heading', { name: 'Nuevo grupo' });
});

it('expone el ID numérico de grupo requerido por las inscripciones masivas', async () => {
  render(<GruposPage />);
  const listado = await screen.findByRole('region', { name: 'Listado de grupos' });
  expect(within(listado).getByRole('columnheader', { name: 'ID' })).toBeTruthy();
  expect(await within(listado).findByText('1')).toBeTruthy();
});
