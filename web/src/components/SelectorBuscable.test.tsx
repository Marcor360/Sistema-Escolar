import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { SelectorBuscable } from './SelectorBuscable';
import { api } from '../api/client';
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
it('permite reintentar después de error de red sin perder búsqueda', async () => {
  const get = vi.spyOn(api, 'get').mockRejectedValueOnce(new Error('Sin conexión')).mockResolvedValue({ data: { datos: [{ id: 1, nombre: 'Uno' }], total: 1 } });
  render(<SelectorBuscable<{ id: number; nombre: string }> ruta="/academico/grupos" valor="" cambiar={() => undefined} etiqueta="Grupo" texto={g => g.nombre} />);
  await screen.findByRole('button', { name: 'Reintentar búsqueda' });
  fireEvent.click(screen.getByRole('button', { name: 'Reintentar búsqueda' }));
  await screen.findByRole('option', { name: 'Uno' });
  expect(get).toHaveBeenCalledTimes(2);
});
