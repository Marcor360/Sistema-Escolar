import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { api } from '../api/client';
import { ModuloTrabajo } from '../components/ModuloTrabajo';
import Maestro from './Maestro';
vi.mock('../auth/AuthContext', () => ({ useAuth: () => ({ tieneRol: () => true }) }));
const clase = {
  id: 7,
  grupo: { nombre: 'A', ciclo: { id: 2, clave: '2026' } },
  materia: { clave: 'MAT', nombre: 'Matemáticas' },
};
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open');
  };
  vi.spyOn(api, 'get').mockImplementation(async (ruta) => ({
    data: ruta.endsWith('/detalle')
      ? clase
      : ruta.includes('clases-seleccion')
        ? { datos: [clase], total: 1 }
        : {
            datos: [{ id: 12, titulo: 'Actividad de prueba', tipo: 'TAREA', parcial: 1, fechaEntrega: null }],
            total: 115,
          },
  }));
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
function montar(query: string) {
  const router = createMemoryRouter(
    [
      {
        path: '/',
        element: (
          <ModuloTrabajo
            titulo="Mis clases"
            acciones={[{ titulo: 'Consultar mis clases', detalle: 'Clases', vista: 'consulta' }]}
            vistas={[
              'clase',
              'actividades',
              'actividad-nueva',
              'actividad-editar',
              'materiales',
              'material-nuevo',
              'material-editar',
              'entregas',
              'calificar-entrega',
            ]}
          >
            <Maestro />
          </ModuloTrabajo>
        ),
      },
    ],
    { initialEntries: ['/?' + query] },
  );
  render(<RouterProvider router={router} />);
  return router;
}
it('abrir clase muestra operaciones sin descargar actividades, materiales ni entregas', async () => {
  montar('vista=clase&clase=7');
  await screen.findByRole('heading', { name: 'Operaciones de esta clase' });
  expect(api.get).toHaveBeenCalledTimes(1);
  expect(api.get).toHaveBeenCalledWith('/grupo-materias/7/detalle');
  expect(screen.queryByLabelText('Título')).toBeNull();
});
it('consulta una página remota y abrir formulario conserva filtros, sin directorio secundario', async () => {
  const r = montar('vista=actividades&clase=7&actividadesPagina=3&actividadesBuscar=prueba');
  await screen.findByText('Actividad de prueba');
  expect(api.get).toHaveBeenCalledWith('/grupo-materias/7/actividades/listado', {
    params: { pagina: 3, porPagina: 10, buscar: 'prueba' },
  });
  await waitFor(() => expect(screen.queryByText('Cargando clase…')).toBeNull());
  fireEvent.click(screen.getByRole('button', { name: 'Volver a operaciones de la clase' }));
  await screen.findByRole('button', { name: 'Crear actividad' });
  fireEvent.click(screen.getByRole('button', { name: 'Crear actividad' }));
  await screen.findByLabelText('Título');
  expect(r.state.location.search).toContain('actividadesPagina=3');
  expect(screen.queryByText('Actividad de prueba')).toBeNull();
  expect(screen.queryByLabelText('Archivo privado del material')).toBeNull();
});
it('fallo de guardado conserva borrador; cancelar salida conserva el formulario', async () => {
  vi.spyOn(api, 'post').mockRejectedValue(new Error('No disponible'));
  montar('vista=actividad-nueva&clase=7');
  await screen.findByLabelText('Título');
  fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Borrador real' } });
  fireEvent.click(screen.getByRole('button', { name: 'Crear actividad' }));
  await screen.findByRole('alert');
  expect((screen.getByLabelText('Título') as HTMLInputElement).value).toBe('Borrador real');
  fireEvent.click(screen.getByRole('button', { name: 'Cancelar y volver a consulta' }));
  await screen.findByRole('dialog');
  fireEvent.click(screen.getByRole('button', { name: /^Cancelar$/ }));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  expect((screen.getByLabelText('Título') as HTMLInputElement).value).toBe('Borrador real');
});
it('muestra la respuesta escrita del alumno al calificar como texto literal', async () => {
  vi.mocked(api.get).mockImplementation(async (ruta) => ({
    data: ruta.endsWith('/detalle')
      ? clase
      : ruta === '/actividades/12'
        ? { id: 12, grupoMateriaId: 7, titulo: 'Actividad escrita' }
        : ruta === '/entregas/33'
          ? {
              id: 33,
              actividadId: 12,
              alumno: { matricula: 'QA33', usuario: { nombre: 'Alumno' } },
              comentarioAlumno: null,
              respuestaTexto: '<script>alert(1)</script>\nRespuesta del alumno',
              calificacion: null,
            }
          : { datos: [], total: 0 },
  }));
  montar('vista=calificar-entrega&clase=7&actividad=12&id=33');
  expect(await screen.findByText(/Respuesta del alumno/)).toBeTruthy();
  expect(document.querySelector('script')).toBeNull();
});

it('permite conservar tres decimales al editar solo retroalimentación de una entrega convertida',async()=>{
 vi.mocked(api.get).mockImplementation(async ruta=>({data:ruta.endsWith('/detalle')?clase:ruta==='/actividades/12'?{id:12,grupoMateriaId:7,titulo:'Actividad'}:ruta==='/entregas/33'?{id:33,actividadId:12,escalaMaxima:10,calificacion:8.533,alumno:{matricula:'QA33',usuario:{nombre:'Alumno'}},comentarioDocente:'Anterior'}:{datos:[],total:0}}));
 const patch=vi.spyOn(api,'patch').mockResolvedValue({data:{}});montar('vista=calificar-entrega&clase=7&actividad=12&id=33');
 const nota=await screen.findByLabelText('Calificación de la entrega');expect(nota.getAttribute('step')).toBe('any');expect((nota as HTMLInputElement).value).toBe('8.533');
 fireEvent.change(screen.getByLabelText('Retroalimentación'),{target:{value:'Solo comentario'}});fireEvent.click(screen.getByRole('button',{name:'Guardar calificación de entrega'}));await waitFor(()=>expect(patch).toHaveBeenCalledWith('/entregas/33/calificar',{calificacion:8.533,escalaMaxima:10,comentario:'Solo comentario'}));
});
