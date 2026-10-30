import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import AperturaCarteraPage from './AperturaCartera';
import { api } from '../api/client';
vi.mock('../auth/AuthContext',()=>({useAuth:()=>({tieneRol:()=>true})}));
afterEach(()=>{cleanup();vi.restoreAllMocks();});
function montar(path:string){ render(<RouterProvider router={createMemoryRouter([{path:'/apertura-cartera',element:<AperturaCarteraPage/>},{path:'/apertura-cartera/nueva',element:<AperturaCarteraPage/>}],{initialEntries:[path]})}/>); }
it('abre panel sin descargar el directorio y consulta diez aperturas por página',async()=>{
  const get=vi.spyOn(api,'get').mockResolvedValue({data:{datos:[],total:0}});
  montar('/apertura-cartera');expect(get).not.toHaveBeenCalled();fireEvent.click(screen.getByRole('button',{name:/Consultar aperturas/}));
  await screen.findByText('Sin aperturas para esta consulta.');expect(get).toHaveBeenCalledWith('/cartera',{params:{pagina:1,porPagina:10,buscar:''}});
});
it('cotiza alumno y cuotas sin correo y obliga a previsualizar tras cambiar el calendario',async()=>{
  vi.spyOn(api,'get').mockImplementation(async ruta=>({data:ruta==='/planteles/mios'?[{id:1,nombre:'Centro'}]:ruta==='/academico/ciclos'?[{id:1,clave:'QA',estado:'ACTIVO'}]:[{id:3,clave:'INS',nombre:'Inscripción',montoBase:125,tipo:'INSCRIPCION',activo:true}]}));
  const post=vi.spyOn(api,'post').mockResolvedValue({data:{cotizacion:'a'.repeat(64),total:125,conceptos:[{conceptoId:3,nombre:'Inscripción',periodo:'2054-02',fechaVencimiento:'2054-02-05',monto:125}]}});
  montar('/apertura-cartera/nueva');await screen.findByLabelText('Total contratado del periodo');
  expect(screen.queryByLabelText('Correo institucional')).toBeNull();
  fireEvent.change(screen.getByLabelText('Plantel'),{target:{value:'1'}});
  fireEvent.change(screen.getByLabelText('Concepto'),{target:{value:'3'}});
  fireEvent.change(screen.getByLabelText('Total contratado del periodo'),{target:{value:'125'}});
  fireEvent.submit(screen.getByRole('button',{name:'Previsualizar apertura'}).closest('form')!);
  await screen.findByRole('button',{name:'Confirmar alumno y cartera'});
  expect(post.mock.calls[0][0]).toBe('/cartera/integral/previsualizar');
  expect(post.mock.calls[0][1]).toMatchObject({asignacion:'PAUSA',total:125,cuotas:[{conceptoId:3,monto:125}]});
  expect((post.mock.calls[0][1] as {nuevoAlumno:object}).nuevoAlumno).not.toHaveProperty('email');
  fireEvent.change(screen.getByLabelText('Fecha de vencimiento'),{target:{value:'2054-02-05'}});
  expect(screen.queryByRole('button',{name:'Confirmar alumno y cartera'})).toBeNull();
});

it('distingue la vigencia del ciclo del mes de cobro y del vencimiento',async()=>{
  vi.spyOn(api,'get').mockImplementation(async ruta=>({data:
    ruta==='/planteles/mios'?[{id:1,nombre:'Centro'}]
    :ruta==='/academico/ciclos'?[{id:7,clave:'2027-C',nombre:'Ciclo 2027',estado:'PREPARACION',fechaInicio:'2027-01-01',fechaFin:'2027-12-31'}]
    :[{id:3,clave:'INS',nombre:'Inscripción',montoBase:125,tipo:'INSCRIPCION',activo:true}]
  }));
  montar('/apertura-cartera/nueva');
  const ciclo=await screen.findByLabelText('Ciclo');
  fireEvent.change(ciclo,{target:{value:'7'}});
  expect(screen.getByLabelText('Vigencia del ciclo').textContent).toContain('2027-01-01');
  expect(screen.getByLabelText('Vigencia del ciclo').textContent).toContain('2027-12-31');
  expect((screen.getByLabelText('Mes de cobro') as HTMLInputElement).value).toBe('');
  expect((screen.getByLabelText('Fecha de vencimiento') as HTMLInputElement).value).toBe('');
});
it('el listado enlaza a una página de detalle y no incrusta el formulario dentro de la celda',async()=>{
  vi.spyOn(api,'get').mockResolvedValue({data:{datos:[{id:4,alumnoId:8,nombreAlumno:'Alumna QA',estado:'PAUSA',grupoId:null,total:200,conceptos:[{nombre:'Colegiatura',monto:100},{nombre:'Colegiatura',monto:100}]}],total:1}});
  montar('/apertura-cartera?vista=consulta&estado=PAUSA&plantelId=1');
  const link=await screen.findByRole('link',{name:'Ver cuotas y pagos de apertura #4'});
  expect(link.getAttribute('href')).toBe('/apertura-cartera/4?vista=consulta&estado=PAUSA&plantelId=1');
  expect(screen.queryByText('Motivo de reanudación')).toBeNull();
  expect(screen.getByText(/2 cuotas/)).toBeTruthy();
});

it('en apertura integral exige ambos apellidos y respeta el orden de identidad', async () => {
  vi.spyOn(api, 'get').mockImplementation(async ruta => ({ data:
    ruta === '/planteles/mios' ? [{ id: 1, nombre: 'Centro' }]
    : ruta === '/academico/ciclos' ? [{ id: 1, clave: 'QA', estado: 'ACTIVO' }]
    : [{ id: 3, clave: 'INS', nombre: 'Inscripción', montoBase: 125, tipo: 'INSCRIPCION', activo: true }]
  }));
  montar('/apertura-cartera/nueva');
  await screen.findByLabelText('Total contratado del periodo');
  const ids = [...document.querySelectorAll<HTMLInputElement>('.cartera-identidad input')].map(c => c.id);
  expect(ids.indexOf('nuevo-nombre')).toBeLessThan(ids.indexOf('nuevo-segundoNombre'));
  expect(ids.indexOf('nuevo-segundoNombre')).toBeLessThan(ids.indexOf('nuevo-apellidoPaterno'));
  expect(ids.indexOf('nuevo-apellidoPaterno')).toBeLessThan(ids.indexOf('nuevo-apellidoMaterno'));
  expect((screen.getByLabelText('Segundo apellido *') as HTMLInputElement).required).toBe(true);
  expect((screen.getByLabelText('Segundo nombre (opcional)') as HTMLInputElement).required).toBe(false);
});
