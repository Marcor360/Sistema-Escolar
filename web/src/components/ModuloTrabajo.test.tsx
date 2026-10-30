import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ModuloTrabajo, useModuloTrabajo } from './ModuloTrabajo';
import { useEffect, useState } from 'react';
import Materias from '../pages/Materias';
import Finanzas from '../pages/Finanzas';
import Usuarios from '../pages/Usuarios';
import Grupos from '../pages/Grupos';
import { api } from '../api/client';
const auth = vi.hoisted(() => ({superadmin:true}));
vi.mock('../auth/AuthContext',()=>({useAuth:()=>({sesion:{sub:1,roles:auth.superadmin?['SUPERADMIN']:['ADMINISTRATIVO']},tieneRol:(...roles:string[])=>auth.superadmin || roles.includes('ADMINISTRATIVO')})}));
beforeEach(()=>{auth.superadmin=true;HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');};});
afterEach(()=>{cleanup();vi.restoreAllMocks();});
const acciones=[{titulo:'Consultar',detalle:'Buscar registros',vista:'consulta'},{titulo:'Registrar',detalle:'Nuevo registro',vista:'nuevo',roles:['SUPERADMIN']}];
function montar(child:React.ReactNode, initial='/modulo', vistas=['editar']) { const router=createMemoryRouter([{path:'/modulo',element:<ModuloTrabajo titulo="Prueba" acciones={acciones} vistas={vistas}>{child}</ModuloTrabajo>},{path:'/otro',element:<p>Otro módulo</p>}],{initialEntries:[initial]});render(<RouterProvider router={router}/>);return router; }
it('no monta el módulo ni descarga catálogos hasta elegir una acción y filtra por rol',async()=>{
 const efecto=vi.fn();function Pagina(){useEffect(efecto,[]);return <p>Operación visible</p>;}
 auth.superadmin=false;montar(<Pagina/>);expect(efecto).not.toHaveBeenCalled();expect(screen.queryByRole('button',{name:/Registrar/})).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:/Consultar/}));await screen.findByText('Operación visible');expect(efecto).toHaveBeenCalledTimes(1);
});
it('cancelar y Atrás confirman cambios, conservan el formulario al rechazar y restauran filtros al salir',async()=>{
 function Pagina(){const t=useModuloTrabajo(),[nombre,setNombre]=useState('');return t.modo==='consulta'?<button onClick={()=>t.ir('nuevo')}>Abrir alta</button>:<label>Nombre<input value={nombre} onChange={e=>setNombre(e.target.value)}/></label>;}
 const router=montar(<Pagina/>,'/modulo?vista=consulta&pagina=3&buscar=Ana');fireEvent.click(screen.getByText('Abrir alta'));fireEvent.change(await screen.findByLabelText('Nombre'),{target:{value:'Borrador'}});
 fireEvent.click(screen.getByText('Cancelar y volver a consulta'));await screen.findByRole('dialog');fireEvent.click(screen.getByRole('button',{name:/^Cancelar$/}));await waitFor(()=>expect([...router.state.blockers.values()].every(b=>b.state==='unblocked')).toBe(true));expect((screen.getByLabelText('Nombre') as HTMLInputElement).value).toBe('Borrador');
 await act(async()=>{await router.navigate(-1);});await screen.findByRole('dialog');fireEvent.click(screen.getByRole('button',{name:'Confirmar'}));await screen.findByText('Abrir alta');expect(router.state.location.search).toBe('?vista=consulta&pagina=3&buscar=Ana');
});
it('un formulario ocupado bloquea la navegación incluso antes de modificar un campo',async()=>{
 function Pagina(){useModuloTrabajo(true);return <p>Guardando</p>;}
 const router=montar(<Pagina/>,'/modulo?vista=nuevo');await screen.findByText('Guardando');await act(async()=>{await router.navigate('/otro');});expect(screen.queryByText('Otro módulo')).toBeNull();expect(router.state.location.pathname).toBe('/modulo');
});
it('materias: alta enfocada no consulta directorios y volver a consulta conserva búsqueda y página',async()=>{
 const get=vi.spyOn(api,'get').mockImplementation(async()=>({data:{datos:[],total:115}}));
 const router=montar(<Materias/>,'/modulo?vista=nuevo&pagina=3&buscar=Fisica');expect(screen.getByLabelText('Clave')).toBeTruthy();expect(get).not.toHaveBeenCalled();expect(screen.queryByRole('table')).toBeNull();
 fireEvent.click(screen.getByText('Cancelar y volver a consulta'));await waitFor(()=>expect(get).toHaveBeenCalledWith('/academico/materias/listado',{params:{pagina:3,porPagina:10,buscar:'Fisica'}}));expect(screen.queryByLabelText('Clave')).toBeNull();expect(router.state.location.search).toContain('pagina=3');expect(get.mock.calls.some(([url])=>url==='/academico/ciclos')).toBe(false);
});
it('finanzas: consultar cargos no monta pagos, conciliación ni formularios',async()=>{
 const get=vi.spyOn(api,'get').mockResolvedValue({data:{datos:[],total:0,pagina:1,porPagina:10}});
 montar(<Finanzas/>,'/modulo?vista=cargos',['cargos']);await waitFor(()=>expect(get).toHaveBeenCalledWith('/finanzas/cargos',{params:{pagina:1,porPagina:10}}));expect(get).toHaveBeenCalledTimes(1);expect(screen.queryByText('Nuevo cargo individual')).toBeNull();expect(screen.queryByText('Registrar pago manual')).toBeNull();
});

it.each(['usuarios','grupos'])('guardar %s vuelve a consulta sin sobrescribir la navegación con otra actualización de filtros', async tipo=>{
 const get = vi.spyOn(api,'get').mockImplementation(async url=>({data:url==='/planteles/mios'?[{id:1,nombre:'Plantel prueba'}]:url==='/academico/ciclos'?[{id:1,clave:'CICLO',activo:true,estado:'ACTIVO'}]:url==='/academico/materias'?[]:{datos:[],total:0,pagina:2,porPagina:10}}));
 const post=vi.spyOn(api,'post').mockResolvedValue({data:{id:9}});
 const router=montar(tipo==='usuarios'?<Usuarios/>:<Grupos/>,'/modulo?vista=nuevo&pagina=2&buscar=criterio');
 if(tipo==='usuarios') {
  fireEvent.change(screen.getByLabelText('Nombre *'),{target:{value:'Personal'}});fireEvent.change(screen.getByLabelText('Primer apellido *'),{target:{value:'Prueba'}});fireEvent.change(screen.getByLabelText('Segundo apellido *'),{target:{value:'Ejemplo'}});fireEvent.change(screen.getByLabelText('Correo institucional *'),{target:{value:'prueba@example.invalid'}});fireEvent.click(await screen.findByLabelText('Plantel prueba'));fireEvent.click(screen.getByRole('button',{name:'Crear'}));
 } else {
  await waitFor(()=>expect(screen.getByLabelText('Plantel').querySelectorAll('option')).toHaveLength(2));
  fireEvent.change(screen.getByLabelText('Plantel'),{target:{value:'1'}});fireEvent.change(screen.getByLabelText('Ciclo'),{target:{value:'1'}});fireEvent.change(screen.getByLabelText('Nombre'),{target:{value:'Grupo prueba'}});fireEvent.click(screen.getByRole('button',{name:'Crear grupo'}));
 }
 await waitFor(()=>expect(post).toHaveBeenCalledTimes(1));await waitFor(()=>expect(router.state.location.search).toContain('vista=consulta'));expect(router.state.location.search).toContain('pagina=2');expect(router.state.location.search).toContain('buscar=criterio');expect(screen.queryByRole('dialog')).toBeNull();
 await waitFor(()=>expect(get.mock.calls.some(([url])=>url===(tipo==='usuarios'?'/usuarios/listado':'/academico/grupos'))).toBe(true));
});

it('admite consulta inicial directa solo en módulos que la solicitan', async () => {
  function Pagina() { const trabajo = useModuloTrabajo(); return <p>Modo actual: {trabajo.modo}</p>; }
  const router = createMemoryRouter([{path:'/calendario',element:<ModuloTrabajo titulo="Calendario" acciones={acciones} vistaInicial="consulta"><Pagina /></ModuloTrabajo>}],{initialEntries:['/calendario']});
  render(<RouterProvider router={router}/>);
  expect(await screen.findByText('Modo actual: consulta')).toBeTruthy();
  expect(screen.queryByRole('heading',{name:'Gestión de calendario'})).toBeNull();
});


it('permite volver a opciones y registrar desde un módulo con consulta inicial', async () => {
  function Pagina() { return <p>Modo actual: {useModuloTrabajo().modo}</p>; }
  const router = createMemoryRouter([{path:'/calendario',element:<ModuloTrabajo titulo="Calendario" acciones={acciones} vistaInicial="consulta"><Pagina /></ModuloTrabajo>}],{initialEntries:['/calendario']});
  render(<RouterProvider router={router}/>);
  fireEvent.click(await screen.findByRole('button', { name: 'Volver a opciones' }));
  expect(await screen.findByRole('heading', { name: 'Gestión de calendario' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: /Registrar/ }));
  expect(await screen.findByText('Modo actual: nuevo')).toBeTruthy();
});
