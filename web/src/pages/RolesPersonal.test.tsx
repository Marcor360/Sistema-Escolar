import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import RolesPersonal from './RolesPersonal';
import { api } from '../api/client';
const sesion = vi.hoisted(() => ({ roles: ['SUPERADMIN'], sub: 7 }));
vi.mock('../auth/AuthContext', () => ({ useAuth: () => ({ sesion }) }));
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it('resume planteles y bloquea cuentas propias o SUPERADMIN sin alterar permisos', async () => {
  vi.spyOn(api, 'get').mockResolvedValue({ data: {
    datos: [
      { id: 7, nombre: 'Cuenta propia', correo: 'propia@ejemplo.test', roles: ['SUPERADMIN'], planteles: [], activo: true },
      { id: 8, nombre: 'Personal autorizado', correo: 'personal@ejemplo.test', roles: ['FINANZAS'], planteles: ['Uno', 'Dos', 'Tres', 'Cuatro'], activo: true },
    ], total: 2, pagina: 1, porPagina: 10,
  } });
  render(<RolesPersonal />);
  const botones = await screen.findAllByRole('button', { name: 'Modificar funciones' });
  expect((botones[0] as HTMLButtonElement).disabled).toBe(true);
  expect((botones[1] as HTMLButtonElement).disabled).toBe(false);
  expect(screen.getByText('4 plantel(es) asignado(s)')).toBeTruthy();
  fireEvent.click(screen.getByText('4 plantel(es) asignado(s)'));
  expect(screen.getByText('Cuatro')).toBeTruthy();
  fireEvent.click(botones[1]);
  expect(screen.getByRole('heading', { name: 'Funciones de Personal autorizado' })).toBeTruthy();
});

it('solicita confirmación accesible antes de revocar funciones y permite cancelar sin cambios', async () => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
  vi.spyOn(api, 'get').mockResolvedValue({ data: {
    datos: [{ id: 8, nombre: 'Personal autorizado', correo: 'personal@ejemplo.test', roles: ['FINANZAS'], planteles: ['Uno'], activo: true }],
    total: 1, pagina: 1, porPagina: 10,
  } });
  const patch = vi.spyOn(api, 'patch').mockResolvedValue({ data: {} });
  render(<RolesPersonal />);
  fireEvent.click(await screen.findByRole('button', { name: 'Modificar funciones' }));
  const guardar = screen.getByRole('button', { name: 'Guardar funciones' });
  fireEvent.click(guardar);
  const dialogo = screen.getByRole('dialog');
  expect(dialogo.textContent).toContain('Personal autorizado');
  expect(dialogo.textContent).toContain('Se revocarán sus sesiones anteriores');
  expect(patch).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Cancelar', hidden: false }).closest('dialog')!.querySelector('button[type="button"]')!);
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  expect(patch).not.toHaveBeenCalled();
  fireEvent.click(guardar);
  fireEvent.click(screen.getByRole('button', { name: 'Actualizar funciones' }));
  await waitFor(() => expect(patch).toHaveBeenCalledWith('/usuarios/8/roles', { roles: ['FINANZAS'] }));
});
