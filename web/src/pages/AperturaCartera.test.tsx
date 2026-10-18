import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import AperturaCarteraPage from './AperturaCartera';
import { api } from '../api/client';
afterEach(()=>{cleanup();vi.restoreAllMocks();});
function montar(path:string){ render(<RouterProvider router={createMemoryRouter([{path:'/apertura-cartera',element:<AperturaCarteraPage/>},{path:'/apertura-cartera/nueva',element:<AperturaCarteraPage/>}],{initialEntries:[path]})}/>); }
it('abre panel sin descargar el directorio y consulta diez aperturas por página',async()=>{
  const get=vi.spyOn(api,'get').mockResolvedValue({data:{datos:[],total:0}});
  montar('/apertura-cartera');expect(get).not.toHaveBeenCalled();fireEvent.click(screen.getByRole('button',{name:/Consultar aperturas/}));
  await screen.findByText('Sin aperturas para esta consulta.');expect(get).toHaveBeenCalledWith('/cartera',{params:{pagina:1,porPagina:10,buscar:''}});
});
it('invalida la confirmación al cambiar datos después de cotizar y no envía montos del cliente',async()=>{
  vi.spyOn(api,'get').mockImplementation(async ruta=>({data:ruta==='/planteles/mios'?[{id:1,nombre:'Centro'}]:ruta==='/academico/ciclos'?[{id:1,clave:'QA',estado:'ACTIVO'}]:[{id:3,clave:'INS',nombre:'Inscripción',montoBase:125,tipo:'INSCRIPCION',activo:true}]}));
  const post=vi.spyOn(api,'post').mockResolvedValue({data:{cotizacion:'a'.repeat(64),total:125,conceptos:[{conceptoId:3,nombre:'Inscripción',monto:125}]}});
  montar('/apertura-cartera/nueva');const concepto=await screen.findByLabelText(/INS · Inscripción/);fireEvent.click(concepto);
  fireEvent.submit(screen.getByRole('button',{name:'Previsualizar apertura'}).closest('form')!);
  await screen.findByRole('button',{name:'Confirmar inscripción y cargos'});
  expect(post.mock.calls[0][1]).not.toHaveProperty('monto');
  fireEvent.change(screen.getByLabelText('Fecha de vencimiento'),{target:{value:'2054-02-05'}});
  expect(screen.queryByRole('button',{name:'Confirmar inscripción y cargos'})).toBeNull();
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
