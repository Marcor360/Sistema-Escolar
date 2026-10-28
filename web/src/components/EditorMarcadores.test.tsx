import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { EditorMarcadores } from './EditorMarcadores';
import { api } from '../api/client';
vi.mock('../marca/MarcaContext', async (original) => ({
  ...(await original<typeof import('../marca/MarcaContext')>()),
}));
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
it('guarda nombre, color y forma con revisión del plantel y no presenta éxito si hay conflicto', async () => {
  const post = vi
    .spyOn(api, 'post')
    .mockRejectedValueOnce(new Error('El marcador cambió'))
    .mockResolvedValueOnce({ data: {} });
  const guardado = vi.fn();
  render(
    <EditorMarcadores
      plantelId={4}
      marcadores={[{ clave: 'apertura', nombre: 'Apertura', color: '#FF0000', forma: 'FONDO', revision: 2 }]}
      guardado={guardado}
    />,
  );
  fireEvent.change(screen.getByLabelText('Marcador para configurar'), { target: { value: 'apertura' } });
  fireEvent.change(screen.getByLabelText('Nombre del marcador'), { target: { value: 'Inicio escolar' } });
  fireEvent.change(screen.getByLabelText('Color del marcador'), { target: { value: '#123456' } });
  fireEvent.click(screen.getByRole('button', { name: 'Guardar marcador' }));
  await screen.findByRole('alert');
  expect(guardado).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Guardar marcador' }));
  await waitFor(() => expect(guardado).toHaveBeenCalledTimes(1));
  expect(post).toHaveBeenLastCalledWith('/calendario/marcadores', {
    plantelId: 4,
    clave: 'apertura',
    nombre: 'Inicio escolar',
    color: '#123456',
    forma: 'FONDO',
    revision: 2,
  });
});
