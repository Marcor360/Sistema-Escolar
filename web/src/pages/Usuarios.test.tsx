import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { api } from '../api/client';
import UsuariosPage from './Usuarios';

vi.mock('../auth/AuthContext', () => ({ useAuth: () => ({
  sesion: { roles: ['SUPERADMIN'] },
}) }));
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it('presenta cuentas en una tabla semántica adaptable con etiquetas por dato', async () => {
  vi.spyOn(api, 'get').mockImplementation(async (url) => ({
    data: url === '/planteles/mios' ? [{ id: 1, nombre: 'Centro' }]
      : { datos: [{ id: 9, matricula: 'AL9', nombre: 'Alumna QA', correo: 'qa@example.test',
        plantel: 'Centro', estatus: 'ACTIVO' }], total: 1, pagina: 1, porPagina: 20 },
  }));
  render(<UsuariosPage />);
  await waitFor(() => expect(screen.getByText('Alumna QA')).toBeTruthy());
  const region = screen.getByRole('region', { name: 'Listado de usuarios' });
  const tabla = region.querySelector('table');
  expect(tabla?.classList.contains('tabla-adaptable')).toBe(true);
  expect(region.querySelector('[data-etiqueta="Correo"]')?.textContent).toBe('qa@example.test');
  expect(screen.getByRole('button', { name: 'Crear' })).toBeTruthy();
});

it('lleva el foco al formulario después de cargar una corrección de personal', async () => {
  const { fireEvent } = await import('@testing-library/react');
  vi.spyOn(api, 'get').mockImplementation(async (url) => ({ data:
    url === '/planteles/mios' ? [{ id: 1, nombre: 'Centro' }]
      : url === '/usuarios/9/personal' ? { id: 9, activo: true, plantelIds: [1], roles: [{ clave: 'ADMINISTRATIVO' }], nombre: 'Personal', apellidoPaterno: 'Prueba', email: 'personal@example.test' }
        : { datos: [{ id: 9, nombre: 'Personal Prueba', correo: 'personal@example.test', roles: ['ADMINISTRATIVO'], planteles: ['Centro'], activo: true }], total: 1, pagina: 1, porPagina: 20 },
  }));
  render(<UsuariosPage />);
  await screen.findByText('Personal Prueba');
  fireEvent.click(screen.getByRole('button', { name: 'Personal' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Corregir cuenta' }));
  const titulo = await screen.findByRole('heading', { name: 'Corregir cuenta de personal' });
  await waitFor(() => expect(document.activeElement).toBe(titulo));
  expect((screen.getByLabelText('Nombre *') as HTMLInputElement).value).toBe('Personal');
});

it('filtra alumnos sin correo y asigna el institucional solicitando activación desde Usuarios',async()=>{
  const {fireEvent}=await import('@testing-library/react');
  const get=vi.spyOn(api,'get').mockImplementation(async url=>({data:url==='/planteles/mios'?[{id:1,nombre:'Centro'}]:{datos:[{id:9,usuarioId:90,matricula:'SIN9',nombre:'Alumno sin correo',correo:null,estatus:'ACTIVO'}],total:1,pagina:1,porPagina:10}}));
  const post=vi.spyOn(api,'post').mockResolvedValue({data:{mensaje:'Correo asignado. Activación solicitada.'}});
  render(<UsuariosPage/>);await screen.findByText('Alumno sin correo');
  fireEvent.click(screen.getByLabelText('Mostrar alumnos sin correo institucional'));
  await waitFor(()=>expect(get).toHaveBeenCalledWith('/usuarios/listado',expect.objectContaining({params:expect.objectContaining({sinCorreo:'true',tipo:'ALUMNO'})})));
  const asignar=screen.getByRole('button',{name:'Asignar correo institucional'});
  fireEvent.click(asignar);
  await waitFor(()=>expect(document.activeElement).toBe(screen.getByRole('heading',{name:'Asignar correo institucional: Alumno sin correo'})));
  fireEvent.click(screen.getByRole('button',{name:'Cancelar'}));
  expect(document.activeElement).toBe(asignar);
  fireEvent.click(asignar);
  fireEvent.change(screen.getByLabelText('Correo institucional'),{target:{value:'alumno@example.invalid'}});
  fireEvent.click(screen.getByRole('button',{name:'Asignar correo y solicitar activación'}));
  await screen.findByText('Correo asignado. Activación solicitada.');
  expect(post).toHaveBeenCalledWith('/usuarios/alumnos/9/correo-institucional',{email:'alumno@example.invalid',correoProveedor:'MICROSOFT365'});
});

it('captura nombre, segundo nombre opcional, dos apellidos y correo en ese orden', async () => {
  const { fireEvent } = await import('@testing-library/react');
  vi.spyOn(api, 'get').mockImplementation(async ruta => ({ data: ruta === '/planteles/mios' ? [{ id: 1, nombre: 'Centro' }] : { datos: [], total: 0, pagina: 1, porPagina: 10 } }));
  const post = vi.spyOn(api, 'post').mockResolvedValue({ data: { id: 8 } });
  render(<UsuariosPage />);
  const orden = [...document.querySelectorAll<HTMLInputElement>('.identidad-formulario input')].map(campo => campo.id);
  expect(orden.slice(0, 5)).toEqual(['personal-nombre', 'personal-segundo-nombre', 'personal-paterno', 'personal-materno', 'personal-correo']);
  fireEvent.change(screen.getByLabelText('Nombre *'), { target: { value: 'Ana' } });
  fireEvent.change(screen.getByLabelText('Segundo nombre (opcional)'), { target: { value: 'Lucía' } });
  fireEvent.change(screen.getByLabelText('Primer apellido *'), { target: { value: 'Pérez' } });
  fireEvent.change(screen.getByLabelText('Segundo apellido *'), { target: { value: 'García' } });
  fireEvent.change(screen.getByLabelText('Correo institucional *'), { target: { value: 'ana@example.invalid' } });
  fireEvent.click(await screen.findByLabelText('Centro'));
  fireEvent.click(screen.getByRole('button', { name: 'Crear' }));
  await waitFor(() => expect(post).toHaveBeenCalledWith('/usuarios', expect.objectContaining({
    nombre: 'Ana', segundoNombre: 'Lucía', apellidoPaterno: 'Pérez', apellidoMaterno: 'García', email: 'ana@example.invalid',
  })));
});
