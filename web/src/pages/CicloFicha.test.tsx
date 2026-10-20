import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import { api } from '../api/client';
import CicloFicha from './CicloFicha';
vi.mock('../auth/AuthContext', () => ({ useAuth: () => ({ tieneRol: () => true }) }));
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
it('muestra conteos reales, contexto histórico y paginación independiente de grupos y asignaturas', async () => {
  vi.spyOn(api, 'get').mockResolvedValue({ data: { ciclo: { id: 7, nombre: 'Ciclo ejemplo', clave: '2026', fechaInicio: '2026-01-01', fechaFin: '2026-12-31', estado: 'ACTIVO' }, resumen: { grupos: 12, docentes: 3 }, datos: [{ id: 4, nombre: 'A', activo: true, tipo: 'REGULAR', turno: null, plantel: { nombre: 'Centro' }, nivel: null, carrera: null, plan: null, periodo: null }], total: 12, clases: { datos: [{ id: 19, grupo: 'A', clave: 'MAT', materia: 'Matemáticas', docente: { nombre: 'Docente ejemplo' } }], total: 15 } } });
  const router = createMemoryRouter([{ path: '/ciclos/:id', element: <CicloFicha /> }], { initialEntries: ['/ciclos/7'] }); render(<RouterProvider router={router} />);
  await screen.findByText('Docente ejemplo · Clase 19'); expect(screen.getByText(/Sin nivel registrado/)).toBeTruthy(); expect(screen.getByRole('link', { name: 'Consultar temario de Matemáticas' }).getAttribute('href')).toBe('/temarios?vista=consulta&clase=19');
  fireEvent.click(screen.getAllByRole('button', { name: 'Ir a la página siguiente' })[1]); await waitFor(() => expect(api.get).toHaveBeenLastCalledWith('/academico/ciclos/7/ficha', { params: { pagina: 1, clasesPagina: 2, buscar: '', porPagina: 10 } })); expect(router.state.location.search).toContain('clasesPagina=2');
});
