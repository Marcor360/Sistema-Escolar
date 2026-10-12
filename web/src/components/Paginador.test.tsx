import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Paginador } from './Paginador';

afterEach(cleanup);

describe('Paginador', () => {
  it('anuncia el rango y deshabilita retroceso en la primera página', () => {
    const onCambio = vi.fn();
    render(<Paginador total={45} pagina={1} porPagina={20} onCambio={onCambio} />);
    expect(screen.getByRole('status').textContent).toContain('1–20 de 45');
    expect((screen.getByRole('button', { name: 'Ir a la página anterior' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Ir a la página siguiente' }));
    expect(onCambio).toHaveBeenCalledWith(2);
  });

  it('indica cuando no hay registros y evita navegar más allá del final', () => {
    render(<Paginador total={0} pagina={1} porPagina={20} onCambio={vi.fn()} />);
    expect(screen.getByRole('status').textContent).toContain('Sin registros');
    expect((screen.getByRole('button', { name: 'Ir a la página siguiente' }) as HTMLButtonElement).disabled).toBe(true);
  });
});
