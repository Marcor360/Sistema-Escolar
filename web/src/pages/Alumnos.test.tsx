import { MemoryRouter } from 'react-router-dom';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { api } from '../api/client';
import AlumnosPage from './Alumnos';

const contexto = vi.hoisted(() => ({ gestionar: false }));
vi.mock('../auth/AuthContext', () => ({ useAuth: () => ({ tieneRol: () => contexto.gestionar }) }));
afterEach(() => { cleanup(); vi.restoreAllMocks(); contexto.gestionar = false; });
function pendiente() {
  let resolver!: (value: { data: ReturnType<typeof resultado> }) => void;
  let rechazar!: (reason: Error) => void;
  const promesa = new Promise<{ data: ReturnType<typeof resultado> }>((resolve, reject) => {
    resolver = resolve; rechazar = reject;
  });
  return { promesa, resolver, rechazar };
}
function resultado(matricula: string) {
  return { datos: [{ id: 1, matricula, estatus: 'ACTIVO', usuario: {
    nombre: 'Alumno QA', apellidoPaterno: 'Prueba', email: 'qa@example.test',
  }, plantel: { id: 1, nombre: 'Plantel QA' } }], total: 1, pagina: 1, porPagina: 20 };
}
function buscar(termino: string) {
  const campo = screen.getByLabelText('Buscar por matrícula');
  fireEvent.change(campo, { target: { value: termino } });
  fireEvent.keyDown(campo, { key: 'Enter' });
}

it('una búsqueda lenta no reemplaza los resultados de la búsqueda más reciente', async () => {
  const anterior = pendiente(); const reciente = pendiente();
  vi.spyOn(api, 'get').mockImplementation((url, config) => {
    if (url !== '/alumnos') return Promise.resolve({ data: [] });
    const termino = (config?.params as { buscar?: string } | undefined)?.buscar;
    return termino === 'ANTERIOR' ? anterior.promesa : termino === 'RECIENTE'
      ? reciente.promesa : Promise.resolve({ data: resultado('INICIAL') });
  });
  render(<MemoryRouter><AlumnosPage /></MemoryRouter>); await screen.findByText('INICIAL');
  buscar('ANTERIOR'); buscar('RECIENTE');
  await act(async () => { reciente.resolver({ data: resultado('RECIENTE') }); });
  expect(screen.getByText('RECIENTE')).toBeTruthy();
  await act(async () => { anterior.resolver({ data: resultado('ANTERIOR') }); });
  expect(screen.queryByText('ANTERIOR')).toBeNull();
  expect(screen.getByText('RECIENTE')).toBeTruthy();
  expect(screen.getByRole('table').getAttribute('aria-busy')).toBe('false');
});

it('un error tardío no borra el estado de carga ni muestra errores de una búsqueda antigua', async () => {
  const anterior = pendiente(); const reciente = pendiente();
  vi.spyOn(api, 'get').mockImplementation((url, config) => url !== '/alumnos'
    ? Promise.resolve({ data: [] }) : (config?.params as { buscar?: string } | undefined)?.buscar === 'RECIENTE'
      ? reciente.promesa : anterior.promesa);
  render(<MemoryRouter><AlumnosPage /></MemoryRouter>);
  buscar('RECIENTE');
  await act(async () => { anterior.rechazar(new Error('Fallo antiguo')); });
  expect(screen.queryByRole('alert')).toBeNull();
  expect(screen.getByRole('table').getAttribute('aria-busy')).toBe('true');
  await act(async () => { reciente.resolver({ data: resultado('RECIENTE') }); });
  expect(screen.getByText('RECIENTE')).toBeTruthy();
  expect(screen.getByRole('table').getAttribute('aria-busy')).toBe('false');
});

it('muestra el error de la búsqueda vigente y permite reintentar', async () => {
  const get = vi.spyOn(api, 'get').mockImplementation(async (url) => {
    if (url !== '/alumnos') return { data: [] };
    throw new Error('Sin conexión');
  });
  render(<MemoryRouter><AlumnosPage /></MemoryRouter>); await screen.findByRole('alert');
  await waitFor(() => expect((screen.getByRole('button', { name: /^Buscar$/ }) as HTMLButtonElement).disabled).toBe(false));
  get.mockResolvedValue({ data: resultado('RECUPERADO') });
  buscar('RECUPERADO');
  await screen.findByText('RECUPERADO');
  expect(screen.queryByRole('alert')).toBeNull();
});

it('al volver a la página usa una solicitud nueva aunque la anterior siga pendiente', async () => {
  const anterior = pendiente();
  const get = vi.spyOn(api, 'get').mockImplementation((url) => url === '/alumnos'
    ? anterior.promesa : Promise.resolve({ data: [] }));
  const vista = render(<MemoryRouter><AlumnosPage /></MemoryRouter>); vista.unmount();
  get.mockImplementation(async (url) => ({ data: url === '/alumnos' ? resultado('NUEVO') : [] }));
  render(<MemoryRouter><AlumnosPage /></MemoryRouter>); await screen.findByText('NUEVO');
  await act(async () => { anterior.resolver({ data: resultado('ANTIGUO') }); });
  expect(screen.queryByText('ANTIGUO')).toBeNull();
  expect(screen.getByText('NUEVO')).toBeTruthy();
});


it('la página siguiente conserva los filtros aplicados aunque haya cambios sin buscar', async () => {
  const get = vi.spyOn(api, 'get').mockImplementation(async (url, config) => {
    if (url === '/planteles/mios') return { data: [
      { id: 1, nombre: 'Plantel Uno' },
      { id: 2, nombre: 'Plantel Dos' },
    ] };
    const params = (config?.params ?? {}) as { pagina?: number; buscar?: string; plantelId?: string };
    return { data: { ...resultado(params.buscar || 'INICIAL'), total: 45, pagina: params.pagina ?? 1 } };
  });
  render(<MemoryRouter><AlumnosPage /></MemoryRouter>);
  await screen.findByText('INICIAL');

  fireEvent.change(screen.getByLabelText('Filtrar por plantel'), { target: { value: '1' } });
  buscar('APLICADO');
  await screen.findByText('APLICADO');

  fireEvent.change(screen.getByLabelText('Buscar por matrícula'), { target: { value: 'BORRADOR' } });
  fireEvent.change(screen.getByLabelText('Filtrar por plantel'), { target: { value: '2' } });
  fireEvent.click(screen.getByRole('button', { name: 'Ir a la página siguiente' }));

  await waitFor(() => expect(get).toHaveBeenLastCalledWith('/alumnos', {
    params: { pagina: 2, buscar: 'APLICADO', plantelId: '1' },
  }));
  expect(screen.getByText('APLICADO')).toBeTruthy();
});

it('una mutación pendiente refresca los filtros vigentes, sin restaurar la búsqueda anterior', async () => {
  contexto.gestionar = true;
  const get = vi.spyOn(api, 'get').mockImplementation(async (url, config) => ({ data: url === '/alumnos'
    ? resultado((config?.params as { buscar?: string })?.buscar || 'INICIAL') : [] }));
  const guardado = pendiente();
  vi.spyOn(api, 'post').mockReturnValue(guardado.promesa);
  render(<MemoryRouter><AlumnosPage /></MemoryRouter>); await screen.findByText('INICIAL');
  buscar('ANTERIOR'); await screen.findByText('ANTERIOR');
  fireEvent.submit(screen.getByLabelText('Matrícula *').closest('form')!);
  buscar('VIGENTE'); await screen.findByText('VIGENTE');
  await act(async () => { guardado.resolver({ data: resultado('CREADO') }); });
  await waitFor(() => expect(get).toHaveBeenLastCalledWith('/alumnos', { params: { pagina: 1, buscar: 'VIGENTE' } }));
  expect(screen.getByText('VIGENTE')).toBeTruthy();
});

it('limpiar descarta el filtro aplicado y los cambios que todavía no se buscaron', async () => {
  const get = vi.spyOn(api, 'get').mockImplementation(async (url, config) => ({ data: url === '/alumnos'
    ? resultado((config?.params as { buscar?: string })?.buscar || 'TODOS') : [] }));
  render(<MemoryRouter><AlumnosPage /></MemoryRouter>); await screen.findByText('TODOS');
  buscar('APLICADO'); await screen.findByText('APLICADO');
  fireEvent.change(screen.getByLabelText('Buscar por matrícula'), { target: { value: 'BORRADOR' } });
  fireEvent.click(screen.getByRole('button', { name: 'Limpiar filtros' }));
  await screen.findByText('TODOS');
  expect(get).toHaveBeenLastCalledWith('/alumnos', { params: { pagina: 1 } });
  expect((screen.getByLabelText('Buscar por matrícula') as HTMLInputElement).value).toBe('');
  expect(screen.queryByRole('button', { name: 'Limpiar filtros' })).toBeNull();
});

it('tras registrar un alumno ofrece continuar con apertura de cartera y no con Grupos', async () => {
  contexto.gestionar = true;
  vi.spyOn(api, 'get').mockImplementation(async (url) => ({ data: url === '/alumnos' ? resultado('IUA-001') : [{ id: 1, nombre: 'Plantel QA' }] }));
  vi.spyOn(api, 'post').mockResolvedValue({ data: { id: 8 } });
  render(<MemoryRouter><AlumnosPage /></MemoryRouter>);
  await screen.findByText('IUA-001');
  fireEvent.change(screen.getByLabelText('Matrícula *'), { target: { value: 'IUA-002' } });
  fireEvent.submit(screen.getByLabelText('Matrícula *').closest('form')!);
  const enlace = await screen.findByRole('link', { name: 'Continuar con apertura de cartera' });
  expect(enlace.getAttribute('href')).toBe('/apertura-cartera/nueva');
  expect(screen.queryByRole('link', { name: /Ir a Grupos para inscribir/ })).toBeNull();
});

it.each(['respuesta', 'error'])('ignora %s de notas después de cerrar el historial', async (tipo) => {
  contexto.gestionar = true;
  let resolver!: (value: unknown) => void;
  let rechazar!: (error: Error) => void;
  const lenta = new Promise((resolve, reject) => { resolver = resolve; rechazar = reject; });
  vi.spyOn(api, 'get').mockImplementation((url) => {
    if (url.startsWith('/calificaciones/alumno/')) return lenta as ReturnType<typeof api.get>;
    if (url.endsWith('/historial/listado')) return Promise.resolve({ data: { datos: [{ id: 8, grupo: { id: 2, nombre: 'Grupo QA', ciclo: { id: 3, nombre: '2026' }, plantel: { nombre: 'Centro' } } }], total: 1, pagina: 1, porPagina: 10 } });
    return Promise.resolve({ data: url === '/alumnos' ? resultado('QA') : [] });
  });
  render(<MemoryRouter><AlumnosPage /></MemoryRouter>);
  fireEvent.click(await screen.findByRole('button', { name: 'Historial y boleta' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Ver calificaciones' }));
  fireEvent.click(screen.getByRole('button', { name: 'Cerrar historial' }));
  await act(async () => { if (tipo === 'error') rechazar(new Error('Error obsoleto')); else resolver({ data: [{ id: 1, grupoMateria: { grupo: { id: 2 }, materia: { nombre: 'Nota obsoleta' } } }] }); });
  expect(screen.queryByText('Nota obsoleta')).toBeNull();
  expect(screen.queryByText('Error obsoleto')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Historial y boleta' }));
  await screen.findByRole('button', { name: 'Ver calificaciones' });
  expect(screen.queryByRole('table', { name: 'Calificaciones de la inscripción' })).toBeNull();
  expect(screen.queryByText('Nota obsoleta')).toBeNull();
});
