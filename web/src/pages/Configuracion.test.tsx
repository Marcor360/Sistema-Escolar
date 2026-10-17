import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import ConfiguracionPage from './Configuracion';
import { api } from '../api/client';
vi.mock('../marca/MarcaContext', () => {
  const marca = { nombreInstitucion: 'Escuela', nombreCorto: 'SE', colorPrimario: '#14343B', colorAcento: '#C79A3C', logoUrl: null };
  return { useMarca: () => ({ marca, recargar: vi.fn() }) };
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
it('dos envíos inmediatos guardan una sola vez y anuncian el resultado', async () => {
  let terminar!: (r: { data: object }) => void;
  const put = vi.spyOn(api,'put').mockImplementation(() => new Promise((r) => { terminar = r; }));
  render(<ConfiguracionPage />); const form = screen.getByLabelText('Nombre de la institución').closest('form')!;
  fireEvent.submit(form); fireEvent.submit(form); expect(put).toHaveBeenCalledTimes(1); expect(form.getAttribute('aria-busy')).toBe('true');
  terminar({ data: {} }); await screen.findByRole('status'); expect(form.getAttribute('aria-busy')).toBe('false');
});
it('preserva la edición después de un fallo y permite reintentar', async () => {
  const put = vi.spyOn(api,'put').mockRejectedValueOnce(new Error('Red caída')).mockResolvedValue({ data: {} });
  render(<ConfiguracionPage />); const input = screen.getByLabelText('Nombre de la institución') as HTMLInputElement;
  fireEvent.change(input,{ target: { value: 'Nombre corregido' } }); fireEvent.submit(input.closest('form')!);
  await screen.findByRole('alert'); expect(input.value).toBe('Nombre corregido');
  await waitFor(() => expect((screen.getByText('Guardar cambios') as HTMLButtonElement).disabled).toBe(false));
  fireEvent.submit(input.closest('form')!); await screen.findByRole('status'); expect(put).toHaveBeenLastCalledWith('/configuracion/marca',expect.objectContaining({ nombreInstitucion: 'Nombre corregido' }));
});

it('rechaza localmente logos de más de 2 MB sin modificar la marca ni enviar el archivo', () => {
  const put = vi.spyOn(api, 'put');
  const post = vi.spyOn(api, 'post');
  render(<ConfiguracionPage />);
  const archivo = new File([new Uint8Array(2 * 1024 * 1024 + 1)], 'logo.png', { type: 'image/png' });
  fireEvent.change(screen.getByLabelText(/Logo \(PNG, JPG o WebP/), { target: { files: [archivo] } });
  expect(screen.getByRole('alert').textContent).toContain('supera los 2 MB');
  expect((screen.getByRole('button', { name: 'Guardar cambios' }) as HTMLButtonElement).disabled).toBe(true);
  expect(put).not.toHaveBeenCalled();
  expect(post).not.toHaveBeenCalled();
});
