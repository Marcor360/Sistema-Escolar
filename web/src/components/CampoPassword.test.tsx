import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CampoPassword } from './CampoPassword';

describe('CampoPassword', () => {
  it('permite mostrar y ocultar sin alterar la contraseña', () => {
    render(<CampoPassword id="clave-prueba" value="Clave1234" readOnly />);
    const campo = screen.getByDisplayValue('Clave1234') as HTMLInputElement;
    expect(campo.type).toBe('password');
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar contraseña' }));
    expect(campo.type).toBe('text');
    expect(campo.value).toBe('Clave1234');
    fireEvent.click(screen.getByRole('button', { name: 'Ocultar contraseña' }));
    expect(campo.type).toBe('password');
  });
});
