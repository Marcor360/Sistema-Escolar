import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ModuloTrabajo } from '../components/ModuloTrabajo';
import { api } from '../api/client';
import Conducta from './Conducta';
import Biblioteca from './Biblioteca';
import Calendario from './Calendario';
vi.mock('../auth/AuthContext',()=>({useAuth:()=>({tieneRol:()=>true,sesion:{sub:1,roles:['SUPERADMIN']}})}));
beforeEach(()=>{HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');};});
afterEach(()=>{cleanup();vi.restoreAllMocks();});
function montar(child:React.ReactNode,url:string){const router=createMemoryRouter([{path:'/modulo',element:<ModuloTrabajo titulo="Prueba" acciones={[{titulo:'Consultar',detalle:'Directorio',vista:'consulta'},{titulo:'Crear',detalle:'Formulario',vista:'nuevo'},{titulo:'Carpeta',detalle:'Crear carpeta',vista:'carpeta-nueva'},{titulo:'Archivo',detalle:'Subir archivo',vista:'archivo-nuevo'}]} vistas={['editar','seguimiento']}>{child}</ModuloTrabajo>}],{initialEntries:[url]});render(<RouterProvider router={router}/>);return router;}
it('conducta: alta no descarga historial, guarda una vez y vuelve con filtros',async()=>{
 const get=vi.spyOn(api,'get').mockResolvedValue({data:[]}),post=vi.spyOn(api,'post').mockResolvedValue({data:{id:3}});
 const router=montar(<Conducta/>,'/modulo?vista=nuevo&ciclo=9&pagina=3');
 expect(screen.getByLabelText('Descripción interna')).toBeTruthy();expect(get.mock.calls.some(([u])=>u==='/conducta/incidencias')).toBe(false);expect(screen.queryByRole('table')).toBeNull();
 fireEvent.change(screen.getByLabelText('Tipo'),{target:{value:'Observación'}});fireEvent.change(screen.getByLabelText('Descripción interna'),{target:{value:'Nota interna'}});
 // La validación de inscripción la realiza la API; envío programático aísla la navegación posterior al commit.
 get.mockImplementation(async u=>({data:u==='/conducta/incidencias'?{datos:[],total:0,pagina:3}:[]}));
 fireEvent.submit(screen.getByLabelText('Descripción interna').closest('form')!);
 await waitFor(()=>expect(post).toHaveBeenCalledTimes(1));await waitFor(()=>expect(router.state.location.search).toContain('vista=consulta'));expect(router.state.location.search).toContain('pagina=3');expect(screen.queryByLabelText('Descripción interna')).toBeNull();
 await waitFor(()=>expect(get).toHaveBeenCalledWith('/conducta/incidencias',{params:{pagina:3,porPagina:10,cicloId:'9'}}));
});
it('conducta: seguimiento directo carga solo el detalle y conserva la nota si falla',async()=>{
 const get=vi.spyOn(api,'get').mockResolvedValue({data:{id:7,descripcion:'Incidencia autorizada',estado:'ABIERTA',seguimientos:[]}});vi.spyOn(api,'post').mockRejectedValue(new Error('Sin conexión'));
 montar(<Conducta/>,'/modulo?vista=seguimiento&id=7');await screen.findByText('Incidencia autorizada');expect(get).toHaveBeenCalledTimes(1);expect(screen.queryByRole('table')).toBeNull();
 fireEvent.change(screen.getByLabelText('Nota interna'),{target:{value:'Pendiente de guardar'}});fireEvent.change(screen.getByLabelText('Motivo'),{target:{value:'Seguimiento'}});fireEvent.submit(screen.getByLabelText('Nota interna').closest('form')!);await screen.findByRole('alert');expect((screen.getByLabelText('Nota interna') as HTMLTextAreaElement).value).toBe('Pendiente de guardar');
});
it('biblioteca: crear carpeta no descarga archivos y permite cambiar contexto sin salir del formulario',async()=>{
 const get=vi.spyOn(api,'get').mockImplementation(async u=>({data:u==='/planteles/mios'?[{id:1,nombre:'Sede'}]:u==='/biblioteca/carpetas'?[{id:2,nombre:'Documentos',padreId:null}]:{archivos:[],carpetas:[],total:0,bytes:0,cuota:100,pagina:2,porPagina:10}}));const post=vi.spyOn(api,'post').mockResolvedValue({data:{id:3}});
 const router=montar(<Biblioteca/>,'/modulo?vista=carpeta-nueva&plantel=1&pagina=2');
 await screen.findByRole('option',{name:'Documentos'});fireEvent.change(screen.getByLabelText('Nombre de carpeta'),{target:{value:'Nueva carpeta'}});fireEvent.change(screen.getByLabelText('Carpeta'),{target:{value:'2'}});
 await waitFor(()=>expect(router.state.location.search).toContain('carpeta=2'));expect(screen.queryByRole('dialog')).toBeNull();expect(get.mock.calls.some(([u])=>u==='/biblioteca')).toBe(false);expect(screen.queryByLabelText('Título')).toBeNull();
 fireEvent.submit(screen.getByLabelText(/Nombre de carpeta/).closest('form')!);await waitFor(()=>expect(post).toHaveBeenCalledWith('/biblioteca/carpetas',{plantelId:1,padreId:2,nombre:'Nueva carpeta'}));await waitFor(()=>expect(router.state.location.search).toContain('vista=consulta'));expect(router.state.location.search).toContain('pagina=1');
});
it('calendario: consulta paginada no carga clases ni muestra formulario; edición directa mantiene revisión',async()=>{
 const evento={id:8,titulo:'Examen',tipo:'EXAMEN',creadoPorId:1,grupoId:null,plantel:{id:1,nombre:'Sede'},fechaInicio:'2027-01-05T10:00:00Z',fechaFin:null,descripcion:null,revision:'a'.repeat(64)};
 const get=vi.spyOn(api,'get').mockImplementation(async u=>({data:u==='/calendario/listado'?{datos:[evento],total:115}:u==='/calendario/8'?evento:[]}));const patch=vi.spyOn(api,'patch').mockResolvedValue({data:evento});
 const router=montar(<Calendario/>,'/modulo?vista=consulta&desde=2027-01-01&hasta=2027-01-31&pagina=3&buscar=Examen');
 await screen.findByText('Examen');expect(screen.queryByLabelText('Título')).toBeNull();expect(get.mock.calls.some(([u])=>u==='/academico/grupo-materias')).toBe(false);
 fireEvent.click(screen.getByRole('button',{name:'Editar'}));await screen.findByLabelText('Título');fireEvent.change(screen.getByLabelText('Título'),{target:{value:'Examen corregido'}});fireEvent.submit(screen.getByLabelText('Título').closest('form')!);
 await waitFor(()=>expect(patch).toHaveBeenCalledWith('/calendario/8',expect.objectContaining({revision:evento.revision,titulo:'Examen corregido'})));await waitFor(()=>expect(router.state.location.search).toContain('vista=consulta'));expect(router.state.location.search).toContain('pagina=3');expect(router.state.location.search).toContain('buscar=Examen');
});
it('cancelar un formulario secundario con cambios pide confirmación y conserva los datos al rechazar',async()=>{
 vi.spyOn(api,'get').mockResolvedValue({data:[]});const router=montar(<Conducta/>,'/modulo?vista=nuevo');fireEvent.change(screen.getByLabelText('Descripción interna'),{target:{value:'Borrador'}});fireEvent.click(screen.getByText('Cancelar y volver a consulta'));await screen.findByRole('dialog');fireEvent.click(screen.getByRole('button',{name:/^Cancelar$/}));await act(async()=>{});expect((screen.getByLabelText('Descripción interna') as HTMLTextAreaElement).value).toBe('Borrador');expect(router.state.location.search).toBe('?vista=nuevo');
});
