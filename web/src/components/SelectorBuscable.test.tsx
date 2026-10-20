import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { SelectorBuscable } from './SelectorBuscable';
import { api } from '../api/client';
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
it('permite reintentar después de error de red sin perder búsqueda', async () => {
  const get = vi.spyOn(api, 'get').mockResolvedValueOnce({ data: { datos: [], total: 0 } }).mockRejectedValueOnce(new Error('Sin conexión')).mockResolvedValue({ data: { datos: [{ id: 1, nombre: 'Uno' }], total: 1 } });
  render(<SelectorBuscable<{ id: number; nombre: string }> ruta="/academico/grupos" valor="" cambiar={() => undefined} etiqueta="Grupo" texto={g => g.nombre} />);
  await waitFor(() => expect(screen.getByLabelText('Grupo').getAttribute('aria-busy')).toBe('false'));
  fireEvent.change(screen.getByLabelText('Buscar grupo'), { target: { value: 'Uno' } });
  await screen.findByRole('button', { name: 'Reintentar búsqueda' });
  fireEvent.click(screen.getByRole('button', { name: 'Reintentar búsqueda' }));
  await screen.findByRole('option', { name: 'Uno' });
  expect((screen.getByLabelText('Buscar grupo') as HTMLInputElement).value).toBe('Uno');
  expect(get).toHaveBeenCalledTimes(3);
  expect(get).toHaveBeenLastCalledWith('/academico/grupos', expect.objectContaining({ params: expect.objectContaining({ buscar: 'Uno', pagina: 1, porPagina: 10 }) }));
});

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
