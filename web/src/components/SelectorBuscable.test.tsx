import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { SelectorBuscable } from './SelectorBuscable';
import { api } from '../api/client';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });
it('consulta diez de 115, navega en servidor y busca fuera de la primera página', async () => {
  const get = vi.spyOn(api, 'get').mockImplementation(async (_ruta, config) => {
    const { pagina, porPagina, buscar } = config!.params as { pagina: number; porPagina: number; buscar: string };
    const todos = Array.from({ length: 115 }, (_, n) => ({ id: n + 1, nombre: `Alumno ${n + 1}` }));
    const filtrados = buscar ? todos.filter((a) => a.nombre === buscar) : todos;
    return { data: { datos: filtrados.slice((pagina - 1) * porPagina, pagina * porPagina), total: filtrados.length } };
  });
  render(<SelectorBuscable ruta="/alumnos" valor="" cambiar={vi.fn()} etiqueta="Alumno" texto={(a: { id: number; nombre: string }) => a.nombre} />);
  await screen.findByRole('option', { name: 'Alumno 10' });
  expect(screen.getAllByRole('option')).toHaveLength(11);
  expect(screen.getByLabelText('Página 1 de 12')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Ir a la página siguiente' }));
  await screen.findByRole('option', { name: 'Alumno 11' });
  expect(get).toHaveBeenLastCalledWith('/alumnos', expect.objectContaining({ params: expect.objectContaining({ pagina: 2, porPagina: 10 }) }));
  fireEvent.change(screen.getByLabelText('Buscar alumno'), { target: { value: 'Alumno 115' } });
  await screen.findByRole('option', { name: 'Alumno 115' });
  await waitFor(() => expect(get).toHaveBeenLastCalledWith('/alumnos', expect.objectContaining({ params: expect.objectContaining({ pagina: 1, porPagina: 10, buscar: 'Alumno 115' }) })));
  expect(screen.getAllByRole('option')).toHaveLength(2);
});
