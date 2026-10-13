import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { api } from '../api/client';
import AlumnosPage from './Alumnos';

vi.mock('../auth/AuthContext', () => ({ useAuth: () => ({ tieneRol: () => false }) }));
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
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
  render(<AlumnosPage />); await screen.findByText('INICIAL');
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
  render(<AlumnosPage />);
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
  render(<AlumnosPage />); await screen.findByRole('alert');
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
  const vista = render(<AlumnosPage />); vista.unmount();
  get.mockImplementation(async (url) => ({ data: url === '/alumnos' ? resultado('NUEVO') : [] }));
  render(<AlumnosPage />); await screen.findByText('NUEVO');
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
  render(<AlumnosPage />);
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
