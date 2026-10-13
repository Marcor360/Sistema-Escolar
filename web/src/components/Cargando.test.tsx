import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { Cargando } from './Cargando';

afterEach(cleanup);
it('anuncia la carga y deja las geometrías decorativas fuera del árbol accesible', () => {
  const { container } = render(<Cargando />);
  const estado = screen.getByRole('status', { name: 'Cargando contenido' });
  expect(estado.getAttribute('aria-live')).toBe('polite');
  expect(screen.getByText('Cargando contenido…').getAttribute('aria-hidden')).toBeNull();
  expect(container.querySelectorAll('button, a, input, [tabindex]').length).toBe(0);
  for (const geometria of container.querySelectorAll('.esqueleto-linea')) {
    expect(geometria.closest('[aria-hidden="true"]')).not.toBeNull();
  }
});
