import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import { api } from '../api/client';
import { DetalleApertura } from './DetalleApertura';
const dato = {
  id: 4,
  alumnoId: 8,
  matricula: 'QA8',
  nombreAlumno: 'Alumna QA',
  estado: 'PAUSA',
  grupoId: null,
  total: 200,
  contexto: { plantelId: 1 },
  financiero: { aperturas: [], cargos: [], pagado: 0, saldo: 0 },
};
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
function montar() {
  const router = createMemoryRouter([{ path: '/apertura-cartera/:id', element: <DetalleApertura /> }], {
    initialEntries: ['/apertura-cartera/4?vista=consulta&estado=PAUSA&pagina=2&plantelId=1'],
  });
  render(<RouterProvider router={router} />);
}
it('abre el detalle fuera de la tabla, enfoca el título y conserva los filtros al volver', async () => {
  vi.spyOn(api, 'get').mockImplementation(async (ruta) => ({
    data: ruta === '/academico/grupos' ? { datos: [], total: 0, pagina: 1, porPagina: 10 } : dato,
  }));
  montar();
  await screen.findByText('Alumna QA');
  expect(screen.queryByRole('table')).toBeNull();
  expect(document.activeElement).toBe(screen.getByRole('heading', { level: 1 }));
  expect(screen.getByRole('link', { name: 'Volver a aperturas' }).getAttribute('href')).toContain(
    'estado=PAUSA&pagina=2&plantelId=1',
  );
  expect(screen.getByRole('heading', { name: 'Cartera y pagos registrados' })).toBeTruthy();
});
it('permite reintentar una consulta fallida sin ejecutar una reanudación', async () => {
  vi.spyOn(api, 'get')
    .mockRejectedValueOnce(new Error('Fallo de red'))
    .mockImplementation(async (ruta) => ({
      data: ruta === '/academico/grupos' ? { datos: [], total: 0, pagina: 1, porPagina: 10 } : dato,
    }));
  const post = vi.spyOn(api, 'post');
  montar();
  fireEvent.click(await screen.findByRole('button', { name: 'Reintentar consulta' }));
  await screen.findByText('Alumna QA');
  expect(post).not.toHaveBeenCalled();
});
it('cancelar la confirmación no genera cargos; reanudar actualiza el estado y evita el segundo envío', async () => {
  // jsdom no implementa la API modal nativa.
  const show = vi.fn(function (this: HTMLDialogElement) {
    this.open = true;
  });
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value: show });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.open = false;
    },
  });
  const get = vi
    .spyOn(api, 'get')
    .mockImplementation(async (ruta) => ({
      data: ruta === '/academico/grupos' ? { datos: [], total: 0, pagina: 1, porPagina: 10 } : dato,
    }));
  const post = vi.spyOn(api, 'post').mockResolvedValue({ data: { estado: 'ABIERTA', grupoId: 3 } });
  montar();
  fireEvent.change(await screen.findByLabelText('Motivo de reanudación'), {
    target: { value: 'Incorporación autorizada' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Revisar reanudación' }));
  await screen.findByRole('dialog');
  fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
  expect(post).not.toHaveBeenCalled();
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  fireEvent.click(screen.getByRole('button', { name: 'Revisar reanudación' }));
  await screen.findByRole('dialog');
  get.mockImplementation(async (ruta) => ({
    data:
      ruta === '/academico/grupos'
        ? { datos: [], total: 0, pagina: 1, porPagina: 10 }
        : { ...dato, estado: 'ABIERTA', grupoId: 3 },
  }));
  fireEvent.click(screen.getByRole('button', { name: 'Reanudar cartera' }));
  await screen.findByText('Cartera reanudada y grupo asignado.');
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Revisar reanudación' })).toBeNull());
  expect(post).toHaveBeenCalledTimes(1);
  expect(show).toHaveBeenCalledTimes(2);
});
