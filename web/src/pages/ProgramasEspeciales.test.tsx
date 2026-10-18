import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import ProgramasEspecialesPage from './ProgramasEspeciales';
import { api } from '../api/client';
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
function montar(ruta: string) {
  const router = createMemoryRouter([{ path: '/programas-especiales', element: <ProgramasEspecialesPage /> }, { path: '/programas-especiales/:id', element: <ProgramasEspecialesPage /> }, { path: '/programas-especiales/:id/grupos/:grupo', element: <ProgramasEspecialesPage /> }], { initialEntries: [ruta] });
  render(<RouterProvider router={router} />); return router;
}
it('consulta diferida y paginada sin cargar alumnos ni docentes al abrir el módulo', async () => {
  const get = vi.spyOn(api, 'get').mockResolvedValue({ data: { datos: [], total: 0 } });
  montar('/programas-especiales');
  expect(get).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: /Consultar programas/ }));
  await screen.findByText(/Sin programas/);
  expect(get).toHaveBeenCalledWith('/programas-especiales', { params: { pagina: 1, porPagina: 10, buscar: '' } });
  expect(get.mock.calls.some(([ruta]) => ['/alumnos','/docentes'].includes(ruta))).toBe(false);
});
it('exige cupo explícito y conserva los datos al fallar la creación del grupo', async () => {
  vi.spyOn(api, 'get').mockImplementation(async (ruta) => ({ data: ruta === '/programas-especiales/1' ? { id: 1, nombre: 'Diplomado', estado: 'ACTIVO', plantelId: 2, cicloId: 3 } : ruta === '/academico/materias' ? [{ id: 4, clave: 'A', nombre: 'Asignatura' }] : { datos: [], total: 0 } }));
  const post = vi.spyOn(api, 'post').mockRejectedValue({ response: { data: { message: 'Cupo pendiente de autorización' } } });
  montar('/programas-especiales/1/grupos/nuevo');
  const cupo = await screen.findByLabelText('Cupo manual autorizado');
  expect((cupo as HTMLInputElement).value).toBe('');
  expect((cupo as HTMLInputElement).required).toBe(true);
  expect(cupo.getAttribute('min')).toBe('1');
  fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Grupo manual' } });
  fireEvent.change(cupo, { target: { value: '12' } });
  fireEvent.submit(cupo.closest('form')!);
  await screen.findByRole('alert');
  expect((screen.getByLabelText('Nombre') as HTMLInputElement).value).toBe('Grupo manual');
  expect((cupo as HTMLInputElement).value).toBe('12');
  await waitFor(() => expect(post).toHaveBeenCalledWith('/programas-especiales/1/grupos', expect.objectContaining({ cupoManual: 12, nombre: 'Grupo manual' })));
});
