import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import FinanzasPage from './Finanzas';
import { api } from '../api/client';

// Aislar el contrato de carga de la página; los submódulos conservan sus propias pruebas.
vi.mock('../components/Conciliacion', () => ({ Conciliacion: () => null }));
vi.mock('../components/CatalogoConceptos', () => ({ CatalogoConceptos: () => null }));
vi.mock('../features/finanzas/PanelCargos', () => ({ PanelCargos: ({ cargarCargos, resultadoCargos, crearCargo }: { cargarCargos: (p: number) => void; resultadoCargos: { total: number }; crearCargo: (e: unknown) => void }) => <section role="tabpanel"><p>Cargos: {resultadoCargos.total}</p><button onClick={() => cargarCargos(2)}>Segunda página</button><form onSubmit={crearCargo}><button>Registrar cargo de prueba</button></form></section> }));
vi.mock('../features/finanzas/PanelPagos', () => ({ PanelPagos: ({ resultadoPagos }: { resultadoPagos: { total: number } }) => <section role="tabpanel">Pagos: {resultadoPagos.total}</section> }));
vi.mock('../features/finanzas/PanelAdeudos', () => ({ PanelAdeudos: () => <section role="tabpanel">Adeudos visibles</section> }));
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
const vacio = { datos: [], total: 0, pagina: 1, porPagina: 10 };
const montar = () => {
  const get = vi.spyOn(api, 'get').mockImplementation(async ruta => ({ data: ['/finanzas/conceptos', '/academico/ciclos', '/planteles/mios'].includes(ruta) ? [] : vacio }));
  render(<FinanzasPage />); return get;
};
it('consulta solo la pestaña activa y carga catálogos/planteles una vez', async () => {
  const get = montar();
  await screen.findByText('Cargos: 0');
  await waitFor(() => expect(screen.queryByText('Cargando cargos…')).toBeNull());
  expect(get.mock.calls.map(c => c[0])).toEqual(['/finanzas/conceptos', '/academico/ciclos', '/planteles/mios', '/finanzas/cargos']);
  fireEvent.click(screen.getByRole('tab', { name: 'Pagos' }));
  await screen.findByText('Pagos: 0');
  fireEvent.click(screen.getByRole('tab', { name: 'Adeudos y cobranza' }));
  await screen.findByText('Adeudos visibles');
  expect(get.mock.calls.map(c => c[0])).toEqual(['/finanzas/conceptos', '/academico/ciclos', '/planteles/mios', '/finanzas/cargos', '/finanzas/pagos', '/finanzas/adeudos']);
});
it('ignora errores tardíos de una pestaña abandonada y permite volver a consultar', async () => {
  const get = montar();
  await waitFor(() => expect(screen.queryByText('Cargando cargos…')).toBeNull());
  let rechazar!: (e: Error) => void;
  get.mockImplementationOnce(() => new Promise((_r, reject) => { rechazar = reject; }));
  fireEvent.click(screen.getByText('Segunda página'));
  fireEvent.click(screen.getByRole('tab', { name: 'Pagos' }));
  await screen.findByText('Pagos: 0');
  await act(async () => { rechazar(new Error('Fallo de cargos obsoleto')); });
  expect(screen.queryByRole('alert')).toBeNull();
  fireEvent.click(screen.getByRole('tab', { name: 'Cargos' }));
  await waitFor(() => expect(screen.queryByText('Cargando cargos…')).toBeNull());
  expect(get).toHaveBeenLastCalledWith('/finanzas/cargos', { params: { pagina: 1, porPagina: 10 } });
});
it('una respuesta anterior no sobrescribe la nueva consulta de la misma pestaña', async () => {
  const get = montar();
  await waitFor(() => expect(screen.queryByText('Cargando cargos…')).toBeNull());
  let resolver!: (r: { data: typeof vacio }) => void;
  get.mockImplementationOnce(() => new Promise(resolve => { resolver = resolve; }));
  fireEvent.click(screen.getByText('Segunda página'));
  fireEvent.click(screen.getByRole('tab', { name: 'Pagos' }));
  await screen.findByText('Pagos: 0');
  fireEvent.click(screen.getByRole('tab', { name: 'Cargos' }));
  await waitFor(() => expect(screen.queryByText('Cargando cargos…')).toBeNull());
  await act(async () => { resolver({ data: { ...vacio, total: 99 } }); });
  expect(screen.getByText('Cargos: 0')).toBeDefined();
});
it('al finalizar una operación recarga la pestaña visible entonces', async () => {
  const get = montar();
  await waitFor(() => expect(screen.queryByText('Cargando cargos…')).toBeNull());
  let confirmar!: () => void;
  vi.spyOn(api, 'post').mockImplementationOnce(() => new Promise(resolve => { confirmar = () => resolve({ data: {} }); }));
  fireEvent.click(screen.getByText('Registrar cargo de prueba'));
  fireEvent.click(screen.getByRole('tab', { name: 'Pagos' }));
  await screen.findByText('Pagos: 0');
  await act(async () => { confirmar(); });
  await waitFor(() => expect(get.mock.calls.filter(c => c[0] === '/finanzas/pagos')).toHaveLength(2));
  expect(get.mock.calls.filter(c => c[0] === '/finanzas/cargos')).toHaveLength(1);
});
