import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {api} from '../api/client';
import {ActaEscolar} from './ActaEscolar';
afterEach(()=>{cleanup();vi.restoreAllMocks();});
it('distingue cero, nota pendiente y datos que el sistema no registra',async()=>{
 const get=vi.spyOn(api,'get').mockResolvedValue({data:{institucion:'Escuela',plan:'Derecho',periodo:'Primero',ciclo:'2026',grupo:'A',plantel:'Centro',asignatura:'Civil',docente:'QA',evaluacion:'Parcial 1',escala:'0–100',aviso:'Sin datos de asistencia',faltantes:1,filas:[{alumnoId:1,matricula:'QA1',nombre:'Alumno Uno',calificacion:0,observaciones:''},{alumnoId:2,matricula:'QA2',nombre:'Alumno Dos',calificacion:null,observaciones:''}]}});
 render(<ActaEscolar claseId="7" parcial="1"/>);fireEvent.click(screen.getByRole('button',{name:'Ver acta digital'}));
 await screen.findByRole('region',{name:'Acta digital por alumno'});expect(screen.getByText('0')).toBeTruthy();expect(screen.getByText('Pendiente')).toBeTruthy();expect(screen.getAllByLabelText('Faltas: sin registro')).toHaveLength(2);
 expect(get).toHaveBeenCalledWith('/reportes/formatos/acta/7',{params:{parcial:'1'}});
});
it('descarga la plantilla o el acta llena usando opciones distintas',async()=>{
 const get=vi.spyOn(api,'get').mockResolvedValue({data:new Blob(['xlsx'])});
 vi.stubGlobal('URL',Object.assign(URL,{createObjectURL:vi.fn().mockReturnValue('blob:qa'),revokeObjectURL:vi.fn()}));vi.spyOn(HTMLAnchorElement.prototype,'click').mockImplementation(()=>undefined);
 render(<ActaEscolar claseId="7" parcial="2"/>);fireEvent.click(screen.getByRole('button',{name:'Descargar acta para rellenar'}));
 await waitFor(()=>expect(get).toHaveBeenCalledWith('/reportes/formatos/acta/7/excel',{params:{parcial:'2',plantilla:true},responseType:'blob'}));
 await waitFor(()=>expect((screen.getByRole('button',{name:'Descargar acta con notas guardadas'}) as HTMLButtonElement).disabled).toBe(false));
 fireEvent.click(screen.getByRole('button',{name:'Descargar acta con notas guardadas'}));
 await waitFor(()=>expect(get).toHaveBeenCalledWith('/reportes/formatos/acta/7/excel',{params:{parcial:'2',plantilla:false},responseType:'blob'}));
 vi.unstubAllGlobals();
});
