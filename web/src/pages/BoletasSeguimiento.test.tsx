import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import BoletasSeguimiento from './BoletasSeguimiento';
import { api } from '../api/client';
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
it('muestra pendientes sin respuesta y conserva contexto al cambiar de categoría', async () => {
  const get = vi
    .spyOn(api, 'get')
    .mockImplementation(async (ruta) => ({
      data:
        ruta === '/boletas/seguimiento'
          ? {
              datos: [
                {
                  id: 8,
                  inscripcionId: 8,
                  alumno: 'Alumno QA',
                  matricula: 'QA8',
                  estado: 'PENDIENTE_RESPUESTA',
                  vigente: false,
                  grupo: 'Primero',
                  ciclo: '2058',
                },
              ],
              total: 1,
            }
          : { datos: [], total: 0 },
    }));
  render(
    <MemoryRouter initialEntries={['/boletas?plantelId=3&cicloId=4&grupoId=5']}>
      <BoletasSeguimiento />
    </MemoryRouter>,
  );
  await screen.findByText('Alumno QA');
  fireEvent.click(screen.getByRole('button', { name: 'Pendientes de aceptación' }));
  await waitFor(() =>
    expect(get).toHaveBeenCalledWith(
      '/boletas/seguimiento',
      expect.objectContaining({
        params: expect.objectContaining({ plantelId: '3', cicloId: '4', grupoId: '5', estado: 'PENDIENTE_RESPUESTA' }),
      }),
    ),
  );
  fireEvent.change(screen.getByLabelText('Alumno o matrícula'), { target: { value: 'QA8' } });
  fireEvent.change(screen.getByLabelText('Atención de revisiones'), { target: { value: 'EN_ATENCION' } });
  fireEvent.submit(screen.getByRole('button', { name: 'Aplicar filtros' }).closest('form')!);
  await waitFor(() =>
    expect(get).toHaveBeenCalledWith(
      '/boletas/seguimiento',
      expect.objectContaining({
        params: expect.objectContaining({ buscar: 'QA8', atencion: 'EN_ATENCION', plantelId: '3' }),
      }),
    ),
  );
});
