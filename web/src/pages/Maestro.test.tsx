import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { api } from '../api/client';
import { ModuloTrabajo } from '../components/ModuloTrabajo';
import Maestro from './Maestro';
vi.mock('../auth/AuthContext', () => ({ useAuth: () => ({ tieneRol: () => true }) }));
const clase = { id: 7, grupo: { nombre: 'A', ciclo: { id: 2, clave: '2026' } }, materia: { clave: 'MAT', nombre: 'Matemáticas' } };
beforeEach(() => { HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); }; HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); }; vi.spyOn(api, 'get').mockImplementation(async ruta => ({ data: ruta.endsWith('/detalle') ? clase : ruta.includes('clases-seleccion') ? { datos: [clase], total: 1 } : { datos: [{ id: 12, titulo: 'Actividad de prueba', tipo: 'TAREA', parcial: 1, fechaEntrega: null }], total: 115 } })); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
function montar(query: string) { const router = createMemoryRouter([{ path: '/', element: <ModuloTrabajo titulo="Mis clases" acciones={[{ titulo: 'Consultar mis clases', detalle: 'Clases', vista: 'consulta' }]} vistas={['clase', 'actividades', 'actividad-nueva', 'actividad-editar', 'materiales', 'material-nuevo', 'material-editar', 'entregas', 'calificar-entrega']}><Maestro /></ModuloTrabajo> }], { initialEntries: ['/?' + query] }); render(<RouterProvider router={router} />); return router; }
it('abrir clase muestra operaciones sin descargar actividades, materiales ni entregas', async () => {
  montar('vista=clase&clase=7'); await screen.findByRole('heading', { name: 'Operaciones de esta clase' }); expect(api.get).toHaveBeenCalledTimes(1); expect(api.get).toHaveBeenCalledWith('/grupo-materias/7/detalle'); expect(screen.queryByLabelText('Título')).toBeNull();
});
it('consulta una página remota y abrir formulario conserva filtros, sin directorio secundario', async () => {
  const r = montar('vista=actividades&clase=7&actividadesPagina=3&actividadesBuscar=prueba'); await screen.findByText('Actividad de prueba'); expect(api.get).toHaveBeenCalledWith('/grupo-materias/7/actividades/listado', { params: { pagina: 3, porPagina: 10, buscar: 'prueba' } });
  fireEvent.click(screen.getByRole('button', { name: 'Volver a operaciones de la clase' })); await screen.findByRole('button', { name: 'Crear actividad' }); fireEvent.click(screen.getByRole('button', { name: 'Crear actividad' })); await screen.findByLabelText('Título'); expect(r.state.location.search).toContain('actividadesPagina=3'); expect(screen.queryByText('Actividad de prueba')).toBeNull(); expect(screen.queryByLabelText('Archivo privado del material')).toBeNull();
});
it('fallo de guardado conserva borrador; cancelar salida conserva el formulario', async () => {
  vi.spyOn(api, 'post').mockRejectedValue(new Error('No disponible')); montar('vista=actividad-nueva&clase=7'); await screen.findByLabelText('Título'); fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Borrador real' } }); fireEvent.click(screen.getByRole('button', { name: 'Crear actividad' })); await screen.findByRole('alert'); expect((screen.getByLabelText('Título') as HTMLInputElement).value).toBe('Borrador real');
  fireEvent.click(screen.getByRole('button', { name: 'Cancelar y volver a consulta' })); await screen.findByRole('dialog'); fireEvent.click(screen.getByRole('button', { name: /^Cancelar$/ })); await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull()); expect((screen.getByLabelText('Título') as HTMLInputElement).value).toBe('Borrador real');
});
