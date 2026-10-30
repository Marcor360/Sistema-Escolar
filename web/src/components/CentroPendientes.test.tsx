import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import { api } from '../api/client';
import { CentroPendientes } from './CentroPendientes';
const sesion = vi.hoisted(() => ({ roles: ['ADMINISTRATIVO'] }));
vi.mock('../auth/AuthContext', () => ({ useAuth: () => ({ sesion }) }));
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  sesion.roles = ['ADMINISTRATIVO'];
});
it('filtra por plantel autorizado y descarta los pendientes anteriores durante la nueva consulta', async () => {
  const get = vi
    .spyOn(api, 'get')
    .mockImplementation(async (ruta, config) => ({
      data:
        ruta === '/planteles/mios'
          ? [{ id: 4, nombre: 'Centro' }]
          : [
              {
                titulo: 'Carteras en pausa',
                cantidad: (config?.params as { plantelId?: string } | undefined)?.plantelId ? 1 : 3,
                ruta: '/apertura-cartera?vista=consulta&estado=PAUSA&plantelId=4',
              },
            ],
    }));
  render(
    <MemoryRouter>
      <CentroPendientes />
    </MemoryRouter>,
  );
  await screen.findByText('3');
  fireEvent.change(screen.getByLabelText('Plantel de los pendientes'), { target: { value: '4' } });
  await screen.findByText('1');
  expect(get).toHaveBeenCalledWith('/seguimiento/pendientes', { params: { plantelId: '4' } });
  expect(screen.getByRole('link', { name: /Carteras en pausa/ }).getAttribute('href')).toContain('plantelId=4');
});
it('el alumno consulta sus pendientes sin descargar el catálogo administrativo de planteles', async () => {
  sesion.roles = ['ALUMNO'];
  const get = vi.spyOn(api, 'get').mockResolvedValue({ data: [] });
  render(
    <MemoryRouter>
      <CentroPendientes />
    </MemoryRouter>,
  );
  await waitFor(() => expect(screen.queryByRole('status')).toBeNull());
  expect(screen.queryByRole('combobox')).toBeNull();
  expect(get).toHaveBeenCalledTimes(1);
  expect(get).toHaveBeenCalledWith('/seguimiento/pendientes', { params: {} });
});

it('usa el plantel elegido en el dashboard sin mostrar un segundo selector', async () => {
  const get = vi.spyOn(api, 'get').mockResolvedValue({ data: [{ titulo: 'Pagos pendientes', cantidad: 2, ruta: '/finanzas' }, { titulo: 'Sin incidencias', cantidad: 0, ruta: '/seguimiento' }] });
  render(<MemoryRouter><CentroPendientes plantelIdExterno="7" /></MemoryRouter>);
  await screen.findByText('2');
  expect(screen.queryByLabelText('Plantel de los pendientes')).toBeNull();
  expect(get).toHaveBeenCalledWith('/seguimiento/pendientes', { params: { plantelId: '7' } });
  expect(screen.queryByText('Sin incidencias')).toBeNull();
  fireEvent.click(screen.getByText('Ver categorías al día (1)'));
  expect(screen.getByText('Sin incidencias: 0')).toBeTruthy();
});
