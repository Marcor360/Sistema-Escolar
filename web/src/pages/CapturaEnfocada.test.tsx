import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {createMemoryRouter,RouterProvider} from 'react-router-dom';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {ModuloTrabajo} from '../components/ModuloTrabajo';
import {api} from '../api/client';
import Calificaciones from './Calificaciones';
vi.mock('../auth/AuthContext',()=>({useAuth:()=>({tieneRol:()=>true})}));
const clases=[7,9].map(id=>({id,grupo:{id:8,nombre:'1-A',ciclo:{nombre:'2026'},plantel:{nombre:'Centro'}},materia:{clave:'MAT'+id,nombre:'Materia '+id}}));
beforeEach(()=>{
 HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');};
 vi.spyOn(api,'get').mockImplementation(async url=>({data:url.includes('clases-seleccion')?{datos:clases,total:2}:url.endsWith('/alumnos')?[{alumno:{id:1,matricula:'AL1',usuario:{nombre:'Ana',apellidoPaterno:'Prueba'}}}]:url.endsWith('/historial')?{datos:[],total:0,pagina:1,porPagina:10}:url.includes('/grupo-materia/')?[{alumnoId:1,calificacion:80}]:{estatus:'ABIERTO',inscritos:1,capturados:1,faltantes:0}}));
});
afterEach(()=>{cleanup();vi.restoreAllMocks();});
async function montar(vista='consulta'){
 const router=createMemoryRouter([{path:'/',element:<ModuloTrabajo titulo="Calificaciones" acciones={[{titulo:'Consultar',detalle:'Lectura',vista:'consulta'},{titulo:'Capturar',detalle:'Captura',vista:'nuevo'},{titulo:'Importar',detalle:'Lote',vista:'importar'}]}><Calificaciones/></ModuloTrabajo>}],{initialEntries:['/?vista='+vista]});render(<RouterProvider router={router}/>);
 await waitFor(()=>expect((screen.getByLabelText('Clase') as HTMLSelectElement).disabled).toBe(false));fireEvent.change(screen.getByLabelText('Clase'),{target:{value:'7'}});fireEvent.click(screen.getByRole('button',{name:'Cargar lista'}));await screen.findByLabelText('Calificación de AL1');return router;
}
it('consultar es solo lectura; captura e importación se abren por separado conservando la clase',async()=>{
 const router=await montar();expect((screen.getByLabelText('Calificación de AL1') as HTMLInputElement).closest('fieldset')?.disabled).toBe(true);expect(screen.queryByRole('button',{name:'Guardar calificaciones'})).toBeNull();expect(screen.queryByRole('region',{name:'Importación de calificaciones'})).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'Capturar esta evaluación'}));await waitFor(()=>expect(screen.getByRole('button',{name:'Guardar calificaciones'})).toBeTruthy());expect(router.state.location.search).toContain('vista=nuevo');expect((screen.getByLabelText('Clase') as HTMLSelectElement).value).toBe('7');expect(screen.queryByRole('region',{name:'Historial de modificaciones de notas'})).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'Importar esta evaluación'}));await screen.findByRole('region',{name:'Importación de calificaciones'});expect(screen.queryByLabelText('Calificación de AL1')).toBeNull();expect(router.state.location.search).toContain('vista=importar');
});
it('rechazar el cambio de parcial o clase conserva borrador e identidad de la evaluación',async()=>{
 await montar('nuevo');fireEvent.change(screen.getByLabelText('Calificación de AL1'),{target:{value:'90'}});fireEvent.change(screen.getByLabelText('Parcial'),{target:{value:'2'}});await screen.findByRole('dialog');fireEvent.click(screen.getByRole('button',{name:/^Cancelar$/}));await waitFor(()=>expect(screen.queryByRole('dialog')).toBeNull());expect((screen.getByLabelText('Parcial') as HTMLSelectElement).value).toBe('1');expect((screen.getByLabelText('Calificación de AL1') as HTMLInputElement).value).toBe('90');
 fireEvent.change(screen.getByLabelText('Clase'),{target:{value:'9'}});await screen.findByRole('dialog');fireEvent.click(screen.getByRole('button',{name:/^Cancelar$/}));await waitFor(()=>expect(screen.queryByRole('dialog')).toBeNull());expect((screen.getByLabelText('Clase') as HTMLSelectElement).value).toBe('7');expect((screen.getByLabelText('Calificación de AL1') as HTMLInputElement).value).toBe('90');
});
it('guardar confirma la nota y permite volver a consulta; cancelar cambios conserva el original al salir',async()=>{
 const post=vi.spyOn(api,'post').mockResolvedValue({data:{capturadas:1,sinCambios:0}});const router=await montar('nuevo');fireEvent.change(screen.getByLabelText('Calificación de AL1'),{target:{value:'90'}});fireEvent.change(screen.getByLabelText('Motivo obligatorio al corregir una nota existente'),{target:{value:'Corrección autorizada'}});fireEvent.submit(screen.getByLabelText('Calificación de AL1').closest('form')!);await screen.findByText('1 calificaciones guardadas');expect(post).toHaveBeenCalledTimes(1);
 fireEvent.click(screen.getByText('Cancelar y volver a consulta'));await waitFor(()=>expect(router.state.location.search).toContain('vista=consulta'));expect(screen.queryByRole('dialog')).toBeNull();
 fireEvent.click(screen.getByText('Capturar esta evaluación'));await screen.findByRole('button',{name:'Guardar calificaciones'});fireEvent.change(screen.getByLabelText('Calificación de AL1'),{target:{value:'95'}});fireEvent.click(screen.getByText('Cancelar y volver a consulta'));await screen.findByRole('dialog');fireEvent.click(screen.getByRole('button',{name:'Confirmar'}));await waitFor(()=>expect(router.state.location.search).toContain('vista=consulta'));await waitFor(()=>expect((screen.getByLabelText('Calificación de AL1') as HTMLInputElement).value).toBe('90'));
});
it('un archivo de importación pendiente también exige confirmar el cambio de clase',async()=>{
 await montar();fireEvent.click(screen.getByText('Importar esta evaluación'));const archivo=await screen.findByLabelText('Archivo de calificaciones');fireEvent.change(archivo,{target:{files:[new File(['grupoMateriaId,parcial,alumnoId,calificacion\n7,1,1,90'],'notas.csv',{type:'text/csv'})]}});fireEvent.change(screen.getByLabelText('Clase'),{target:{value:'9'}});await screen.findByRole('dialog');fireEvent.click(screen.getByRole('button',{name:/^Cancelar$/}));await waitFor(()=>expect(screen.queryByRole('dialog')).toBeNull());expect((screen.getByLabelText('Clase') as HTMLSelectElement).value).toBe('7');expect((screen.getByLabelText('Archivo de calificaciones') as HTMLInputElement).files?.[0].name).toBe('notas.csv');
});
