import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Shell } from './Shell';

vi.mock('../auth/AuthContext', () => ({ useAuth: () => ({
  sesion: { nombre: 'Usuario', roles: ['ADMINISTRATIVO'] },
  tieneRol: () => true,
  logout: vi.fn(),
}) }));
vi.mock('../marca/MarcaContext', () => ({ useMarca: () => ({
  marca: { nombreInstitucion: 'Escuela', nombreCorto: 'E', logoUrl: null },
}) }));
vi.mock('../components/Campana', () => ({ Campana: () => null }));

let consulta: EventTarget & { matches: boolean };
beforeEach(() => {
  consulta = Object.assign(new EventTarget(), { matches: true });
  vi.stubGlobal('matchMedia', vi.fn(() => consulta));
  document.body.style.overflow = 'auto';
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  document.body.style.overflow = '';
});

function abrirMenu() {
  const vista = render(<MemoryRouter><Shell /></MemoryRouter>);
  fireEvent.click(screen.getByRole('button', { name: /Abrir menú/ }));
  return vista;
}

it('restaura el scroll y el foco al cerrar con el fondo o Escape', () => {
  abrirMenu();
  expect(document.body.style.overflow).toBe('hidden');
  fireEvent.click(screen.getByRole('button', { name: 'Cerrar navegación' }));
  expect(document.body.style.overflow).toBe('auto');
  expect(document.activeElement).toBe(screen.getByRole('button', { name: /Abrir menú/ }));
  fireEvent.click(screen.getByRole('button', { name: /Abrir menú/ }));
  screen.getByRole('link', { name: 'Alumnos' }).focus();
  fireEvent.keyDown(window, { key: 'Escape' });
  expect(document.body.style.overflow).toBe('auto');
  expect(document.activeElement).toBe(screen.getByRole('button', { name: /Abrir menú/ }));
});

it('cierra el menú y libera el scroll al pasar a escritorio', () => {
  abrirMenu();
  consulta.matches = false;
  act(() => { consulta.dispatchEvent(new Event('change')); });
  expect(document.body.style.overflow).toBe('auto');
  expect(screen.queryByRole('button', { name: 'Cerrar navegación' })).toBeNull();
  consulta.matches = true;
  act(() => { consulta.dispatchEvent(new Event('change')); });
  expect(document.body.style.overflow).toBe('auto');
});

it('libera el scroll al navegar o desmontar el shell', () => {
  const vista = abrirMenu();
  fireEvent.click(screen.getByRole('link', { name: 'Alumnos' }));
  expect(document.body.style.overflow).toBe('auto');
  fireEvent.click(screen.getByRole('button', { name: /Abrir menú/ }));
  vista.unmount();
  expect(document.body.style.overflow).toBe('auto');
});
