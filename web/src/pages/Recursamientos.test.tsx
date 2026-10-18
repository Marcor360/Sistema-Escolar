import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import RecursamientosPage from './Recursamientos';
import { api } from '../api/client';
vi.mock('../auth/AuthContext',()=>({useAuth:()=>({tieneRol:()=>true})}));
afterEach(()=>{cleanup();vi.restoreAllMocks();});
function montar(ruta:string){render(<RouterProvider router={createMemoryRouter([{path:'/recursamientos',element:<RecursamientosPage/>},{path:'/recursamientos/:id',element:<RecursamientosPage/>}],{initialEntries:[ruta]})}/>);}
it('ofrece acciones antes del listado y consulta diez intentos por página',async()=>{
  const get=vi.spyOn(api,'get').mockResolvedValue({data:{datos:[],total:0}});montar('/recursamientos');expect(get).not.toHaveBeenCalled();fireEvent.click(screen.getByRole('button',{name:/Consultar intentos/}));await screen.findByText('Sin intentos para esta consulta.');expect(get).toHaveBeenCalledWith('/recursamientos',{params:{pagina:1,porPagina:10}});
});
it('exige cupo total explícito y explica que no cambia el grupo principal',async()=>{
  vi.spyOn(api,'get').mockImplementation(async ruta=>({data:ruta==='/planteles/mios'?[{id:1,nombre:'Centro'}]:[{id:2,clave:'QA',estado:'ACTIVO'}]}));montar('/recursamientos/nuevo');const cupo=await screen.findByLabelText('Cupo total manual de la clase');expect((cupo as HTMLInputElement).value).toBe('');expect((cupo as HTMLInputElement).required).toBe(true);expect(screen.getByText(/No se aplica la excepción automática/)).toBeTruthy();
});
