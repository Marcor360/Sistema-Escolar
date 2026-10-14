import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { ImportarCalificaciones } from './ImportarCalificaciones';
import { api } from '../api/client';
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
it('descarga XLSX del parcial seleccionado con nombre de clase en periodo cerrado', async () => {
  const blob = new Blob(['xlsx']);
  const get = vi.spyOn(api, 'get').mockResolvedValue({ data: blob });
  const crear = vi.fn(() => 'blob:plantilla');
  vi.stubGlobal('URL', { createObjectURL: crear, revokeObjectURL: vi.fn() });
  let nombre = '';
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) { nombre = this.download; });
  render(<ImportarCalificaciones claseId="7" parcial="2" deshabilitado alConfirmar={() => {}} />);
  fireEvent.click(screen.getByRole('button', { name: 'Descargar plantilla XLSX' }));
  await waitFor(() => expect(crear).toHaveBeenCalledWith(blob));
  expect(get).toHaveBeenCalledWith('/reportes/grupo-materias/7/plantilla-calificaciones.xlsx', { params: { parcial: 2 }, responseType: 'blob' });
  expect(nombre).toBe('plantilla-calificaciones-7-2.xlsx');
});
it('muestra error de descarga y permite reintentar', async () => {
  vi.spyOn(api, 'get').mockRejectedValue(new Error('Descarga fallida'));
  render(<ImportarCalificaciones claseId="7" parcial="1" deshabilitado={false} alConfirmar={() => {}} />);
  fireEvent.click(screen.getByRole('button', { name: 'Descargar plantilla XLSX' }));
  await screen.findByRole('alert');
  await waitFor(() => expect((screen.getByRole('button', { name: 'Descargar plantilla XLSX' }) as HTMLButtonElement).disabled).toBe(false));
});
