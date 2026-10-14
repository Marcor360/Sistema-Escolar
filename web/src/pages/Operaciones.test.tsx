import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { api } from '../api/client';
import OperacionesPage from './Operaciones';

vi.mock('../auth/AuthContext', () => ({ useAuth: () => ({ tieneRol: () => true }) }));
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it('rechaza archivos vacíos y de tipo incorrecto antes de enviarlos a la API', async () => {
  vi.spyOn(api, 'get').mockResolvedValue({ data: [] });
  const post = vi.spyOn(api, 'post');
  render(<OperacionesPage />);
  await waitFor(() => expect(screen.getByLabelText('Tipo')).toBeTruthy());
  const archivo = screen.getByLabelText('Archivo');
  fireEvent.change(archivo, { target: { files: [new File([], 'lote.csv', { type: 'text/csv' })] } });
  fireEvent.click(screen.getByRole('button', { name: 'Previsualizar archivo' }));
  expect(screen.getByRole('alert').textContent).toMatch(/contener datos/);
  expect(post).not.toHaveBeenCalled();
});
it('cambiar de importación obliga a elegir nuevamente el archivo', async () => {
  vi.spyOn(api, 'get').mockResolvedValue({ data: [] });
  render(<OperacionesPage />);
  const archivo = screen.getByLabelText('Archivo');
  fireEvent.change(archivo, { target: { files: [new File(['matricula'], 'alumnos.csv')] } });
  expect((screen.getByRole('button', { name: 'Previsualizar archivo' }) as HTMLButtonElement).disabled).toBe(false);
  fireEvent.change(screen.getByLabelText('Tipo'), { target: { value: 'DOCENTES' } });
  expect((screen.getByRole('button', { name: 'Previsualizar archivo' }) as HTMLButtonElement).disabled).toBe(true);
});
