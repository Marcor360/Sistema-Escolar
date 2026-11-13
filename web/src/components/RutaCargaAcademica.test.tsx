import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import { RutaCargaAcademica } from './RutaCargaAcademica';
const rol = vi.hoisted(() => ({ valor: 'ADMINISTRATIVO' }));
vi.mock('../auth/AuthContext', () => ({ useAuth: () => ({ tieneRol: (...roles: string[]) => roles.includes(rol.valor) }) }));
afterEach(cleanup);
it('ordena la preparación y reserva el alta de alumnos al rol autorizado', () => {
  rol.valor = 'ADMINISTRATIVO';
  render(<MemoryRouter><RutaCargaAcademica /></MemoryRouter>);
  expect(screen.getAllByRole('listitem')).toHaveLength(6);
  expect(screen.getByRole('link', { name: 'Registrar materia' }).getAttribute('href')).toBe('/materias?vista=nuevo');
  expect(screen.queryByRole('link', { name: 'Importar alumnos' })).toBeNull();
});
it('Finanzas accede a alumnos sin recibir accesos de administración académica', () => {
  rol.valor = 'FINANZAS';
  render(<MemoryRouter><RutaCargaAcademica /></MemoryRouter>);
  expect(screen.getByRole('link', { name: 'Importar alumnos' })).toBeTruthy();
  expect(screen.queryByRole('link', { name: 'Crear grupo' })).toBeNull();
});
