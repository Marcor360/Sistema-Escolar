import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { api } from '../api/client';
import { EliminarRegistro } from './EliminarRegistro';
const contexto = vi.hoisted(() => ({ roles: ['SUPERADMIN'] }));
vi.mock('../auth/AuthContext', () => ({ useAuth: () => ({ sesion: { roles: contexto.roles } }) }));
beforeEach(() => {
  contexto.roles = ['SUPERADMIN'];
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it('cancelar no elimina y un conflicto conserva la fila y explica el bloqueo', async () => {
  const borrar = vi.spyOn(api, 'delete').mockRejectedValue({ response: { data: { message: 'El alumno tiene pagos registrados' } } });
  const recargar = vi.fn();
  render(<EliminarRegistro ruta="/alumnos/17" nombre="alumno A17" alEliminar={recargar} />);
  fireEvent.click(screen.getByRole('button', { name: 'Eliminar definitivamente alumno A17' }));
  expect(screen.getByRole('dialog').textContent).toContain('no se puede deshacer');
  fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  expect(borrar).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Eliminar definitivamente alumno A17' }));
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Eliminar definitivamente' }));
  await screen.findByText('El alumno tiene pagos registrados');
  expect(recargar).not.toHaveBeenCalled();
  expect(borrar).toHaveBeenCalledWith('/alumnos/17/permanente', { data: { confirmacion: 'ELIMINAR' } });
});

it('evita doble envío mientras elimina y recarga después del éxito', async () => {
  let resolver!: (value: unknown) => void;
  const borrar = vi.spyOn(api, 'delete').mockImplementation(() => new Promise((r) => { resolver = r; }));
  const recargar = vi.fn();
  render(<EliminarRegistro ruta="/planteles/5" nombre="plantel Centro" alEliminar={recargar} />);
  const boton = screen.getByRole('button', { name: 'Eliminar definitivamente plantel Centro' });
  fireEvent.click(boton); fireEvent.click(boton);
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Eliminar definitivamente' }));
  await waitFor(() => expect(borrar).toHaveBeenCalledTimes(1));
  fireEvent.click(boton);
  expect(borrar).toHaveBeenCalledTimes(1);
  resolver({ data: { ok: true } });
  await waitFor(() => expect(recargar).toHaveBeenCalledTimes(1));
});

it('no ofrece eliminación definitiva a personal local', () => {
  contexto.roles = ['ADMINISTRATIVO'];
  render(<EliminarRegistro ruta="/usuarios/5" nombre="usuario Prueba" alEliminar={vi.fn()} />);
  expect(screen.queryByRole('button')).toBeNull();
});
