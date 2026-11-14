import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { api } from '../api/client';
import { RecursosMarcaPortales } from './RecursosMarcaPortales';

const { marca, recargar } = vi.hoisted(() => ({
  marca: {
    faviconAdministrativoUrl: null as string | null,
    faviconAlumnoUrl: '/uploads/favicon-alumno.png' as string | null,
    logoAlumnoUrl: null as string | null,
  },
  recargar: vi.fn(),
}));
vi.mock('../marca/MarcaContext', () => ({ useMarca: () => ({ marca, recargar }) }));
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it('no elimina un favicon hasta aceptar la confirmación y conserva la opción de cancelar', async () => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
  recargar.mockResolvedValue(undefined);
  const eliminar = vi.spyOn(api, 'delete').mockResolvedValue({ data: {} });
  render(<RecursosMarcaPortales />);
  fireEvent.click(screen.getByRole('button', { name: 'Quitar' }));
  const dialogo = screen.getByRole('dialog');
  expect(dialogo.textContent).toContain('imagen predeterminada');
  expect(eliminar).not.toHaveBeenCalled();
  fireEvent.click(within(dialogo).getByRole('button', { name: 'Cancelar' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  expect(eliminar).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Quitar' }));
  fireEvent.click(screen.getByRole('button', { name: 'Retirar recurso' }));
  await waitFor(() => expect(eliminar).toHaveBeenCalledTimes(1));
  expect(eliminar).toHaveBeenCalledWith('/configuracion/marca/favicon/alumno');
});
