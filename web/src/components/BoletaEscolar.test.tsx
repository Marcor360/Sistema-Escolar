import {act,cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {api} from '../api/client';
import {BoletaEscolar} from './BoletaEscolar';
afterEach(()=>{cleanup();vi.restoreAllMocks();});
it('no abre un archivo tardío tras cambiar de expediente',async()=>{
 let resolver!:(v:{data:Blob})=>void;
 const get=vi.spyOn(api,'get').mockImplementation(async ruta=>ruta.endsWith('/excel')?new Promise(r=>{resolver=r;}):{data:{institucion:'Escuela QA',alumno:'Alumno QA',matricula:'QA1',plantel:'Centro',plan:'Derecho',periodo:'Primero',ciclo:'2026',disponible:true,escala:'0–100',aviso:'Informativa',promedioGeneral:90,filas:[]}});
 const click=vi.spyOn(HTMLAnchorElement.prototype,'click').mockImplementation(()=>undefined);
 const vista=render(<BoletaEscolar alumnoId={1} inscripcionId={8}/>);
 const boton=await screen.findByRole('button',{name:'Descargar boleta Excel'});fireEvent.click(boton);
 await waitFor(()=>expect(get).toHaveBeenCalledWith('/reportes/formatos/boleta/1/excel',expect.objectContaining({params:{inscripcionId:8}})));
 vista.rerender(<BoletaEscolar alumnoId={2} inscripcionId={9}/>);
 await act(async()=>{resolver({data:new Blob(['xlsx'])});});expect(click).not.toHaveBeenCalled();
});
