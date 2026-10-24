import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { SelectorProveedorCorreo } from './SelectorProveedorCorreo';

it('permite seleccionar GoDaddy o Microsoft 365 con etiquetas accesibles', () => {
  const onChange = vi.fn();
  render(<SelectorProveedorCorreo id="proveedor-prueba" value="GODADDY" onChange={onChange} />);
  const selector = screen.getByRole('combobox', { name: 'Correo emisor de notificaciones' });
  expect((selector as HTMLSelectElement).value).toBe('GODADDY');
  expect(screen.getByRole('option', { name: 'Correo GoDaddy' })).toBeTruthy();
  expect(screen.getByRole('option', { name: 'Correo Microsoft 365' })).toBeTruthy();
  fireEvent.change(selector, { target: { value: 'MICROSOFT365' } });
  expect(onChange).toHaveBeenCalledWith('MICROSOFT365');
});
