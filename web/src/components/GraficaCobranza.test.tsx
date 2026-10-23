import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { api } from '../api/client';
import { GraficaCobranza } from './GraficaCobranza';

const serie = (periodo = '2026-10', cobrado = 125) => ({ datos: [{ periodo, cobrado }], moneda: 'MXN', base: 'Pagos confirmados' });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it('muestra carga, error y permite actualizar hasta obtener una serie accesible', async () => {
  const get = vi.spyOn(api, 'get').mockRejectedValueOnce(new Error('Sin conexión')).mockResolvedValue({ data: serie() });
  render(<GraficaCobranza plantelId="3" />);
  expect(screen.getByRole('status').textContent).toContain('Cargando');
  await screen.findByRole('alert');
  fireEvent.click(screen.getByRole('button', { name: 'Actualizar gráfica' }));
  expect((await screen.findByRole('img')).getAttribute('aria-label')).toContain('2026-10');
  expect(get).toHaveBeenLastCalledWith('/reportes/cobranza/serie', { params: { plantelId: 3 } });
});

it('muestra vacío cuando no hay importes confirmados', async () => {
  vi.spyOn(api, 'get').mockResolvedValue({ data: serie('2026-10', 0) });
  render(<GraficaCobranza plantelId="" />);
  await screen.findByText(/No hay ingresos confirmados/);
  expect(screen.queryByRole('img')).toBeNull();
});

it('ignora una respuesta tardía del plantel anterior', async () => {
  let resolver!: (value: { data: ReturnType<typeof serie> }) => void;
  const anterior = new Promise<{ data: ReturnType<typeof serie> }>((r) => { resolver = r; });
  vi.spyOn(api, 'get').mockImplementation(async (_url, config) => (config?.params as { plantelId?: number } | undefined)?.plantelId === 1 ? anterior : { data: serie('2026-11') });
  const { rerender } = render(<GraficaCobranza plantelId="1" />);
  rerender(<GraficaCobranza plantelId="2" />);
  await screen.findByRole('img');
  await act(async () => resolver({ data: serie('2026-09') }));
  expect(screen.getByRole('img').getAttribute('aria-label')).toContain('2026-11');
  expect(screen.getByRole('img').getAttribute('aria-label')).not.toContain('2026-09');
});
