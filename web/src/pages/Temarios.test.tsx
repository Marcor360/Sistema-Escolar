import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ModuloTrabajo } from '../components/ModuloTrabajo';
import { api } from '../api/client';
import Temarios from './Temarios';
vi.mock('../auth/AuthContext', () => ({ useAuth: () => ({ tieneRol: () => true }) }));
const tema = { id: 50, grupoMateriaId: 7, indice: 1, titulo: 'Unidad privada', contenido: 'Contenido de estudio', estado: 'BORRADOR', desde: null, hasta: null, parcial: null, enlace: null, revision: 1, adjuntos: [] };
const clases = [7, 9].map(id => ({ id, materia: { nombre: 'Asignatura ' + id }, grupo: { nombre: 'A', ciclo: { nombre: '2026' }, plantel: { nombre: 'Centro' } } }));
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); }; HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
  vi.spyOn(api, 'get').mockImplementation(async ruta => ({ data: ruta.includes('clases-seleccion') ? { datos: clases, total: 2 } : ruta.includes('/temario') && !ruta.startsWith('/temarios/') ? { datos: [tema], total: 12 } : tema }));
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
function montar(query: string) {
  const r = createMemoryRouter([{ path: '/', element: <ModuloTrabajo titulo="Temarios" acciones={[{ titulo: 'Consultar', detalle: 'Lista', vista: 'consulta' }, { titulo: 'Crear', detalle: 'Tema', vista: 'nuevo' }]} vistas={['detalle', 'editar', 'adjuntar']}><Temarios /></ModuloTrabajo> }], { initialEntries: ['/?' + query] }); render(<RouterProvider router={r} />); return r;
}
it('consulta una página remota conservando clase y búsqueda en la URL, sin descargar historial ni formularios', async () => {
  montar('vista=consulta&clase=7&pagina=2&buscar=Unidad'); await screen.findByText('1. Unidad privada');
  expect(api.get).toHaveBeenCalledWith('/grupo-materias/7/temario', { params: { pagina: 2, porPagina: 10, buscar: 'Unidad' } });
  expect(screen.queryByLabelText('Contenido del tema (texto)')).toBeNull(); expect(api.get).not.toHaveBeenCalledWith('/temarios/50/historial', expect.anything());
});
it('rechazar cambio de clase conserva borrador; fallo de guardado conserva el texto', async () => {
  vi.spyOn(api, 'post').mockRejectedValue(new Error('Error al guardar'));
  montar('vista=nuevo&clase=7'); await waitFor(() => expect((screen.getByLabelText('Clase del temario') as HTMLSelectElement).disabled).toBe(false));
  fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Borrador conservado' } }); fireEvent.change(screen.getByLabelText('Contenido del tema (texto)'), { target: { value: 'Mi contenido' } });
  fireEvent.change(screen.getByLabelText('Clase del temario'), { target: { value: '9' } }); await screen.findByRole('dialog'); fireEvent.click(screen.getByRole('button', { name: /^Cancelar$/ }));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull()); expect((screen.getByLabelText('Clase del temario') as HTMLSelectElement).value).toBe('7'); expect((screen.getByLabelText('Título') as HTMLInputElement).value).toBe('Borrador conservado');
  fireEvent.click(screen.getByRole('button', { name: 'Guardar tema' })); await screen.findByRole('alert'); expect((screen.getByLabelText('Contenido del tema (texto)') as HTMLTextAreaElement).value).toBe('Mi contenido');
});
it('guardar abre detalle sin aviso falso; los adjuntos tienen formulario enfocado aparte', async () => {
  vi.spyOn(api, 'post').mockResolvedValue({ data: tema }); const router = montar('vista=nuevo&clase=7');
  fireEvent.change(screen.getByLabelText('Título'), { target: { value: tema.titulo } }); fireEvent.change(screen.getByLabelText('Contenido del tema (texto)'), { target: { value: tema.contenido } }); fireEvent.click(screen.getByRole('button', { name: 'Guardar tema' }));
  await screen.findByRole('button', { name: 'Agregar adjunto' }); expect(router.state.location.search).toContain('vista=detalle'); expect(screen.queryByRole('dialog')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Agregar adjunto' })); await screen.findByLabelText('Archivo privado'); expect(screen.queryByLabelText('Título')).toBeNull(); expect(screen.queryByRole('button', { name: 'Consultar historial del tema' })).toBeNull();
});
