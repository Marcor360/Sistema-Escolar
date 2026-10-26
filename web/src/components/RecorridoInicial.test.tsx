import { cleanup, render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Link, useLocation } from 'react-router-dom';
import { afterEach, expect, it } from 'vitest';
import { RecorridoInicial } from './RecorridoInicial';

it('permite navegar manualmente sin que el tutorial fuerce regresar a su paso', async () => {
  localStorage.clear();
  function Ubicacion() { return <output data-testid="ruta">{useLocation().pathname}</output>; }
  render(<MemoryRouter initialEntries={['/configuracion']}>
    <Link to="/alumnos">Abrir alumnos</Link><Ubicacion />
    <RecorridoInicial usuarioId={999} roles={['SUPERADMIN']} pasos={[
      { titulo: 'Inicio', descripcion: '', destino: '/panel' },
      { titulo: 'Control', descripcion: '', destino: '/alumnos' },
    ]} />
  </MemoryRouter>);
  await waitFor(() => expect(screen.getByTestId('ruta').textContent).toBe('/panel'));
  fireEvent.click(screen.getByText('Abrir alumnos'));
  await waitFor(() => expect(screen.getByTestId('ruta').textContent).toBe('/alumnos'));
  expect(screen.getByText('Recorrido guiado · 1 de 2')).not.toBeNull();
  fireEvent.click(screen.getByText('Siguiente'));
  expect(screen.getByText('Recorrido guiado · 2 de 2')).not.toBeNull();
  fireEvent.click(screen.getByText('Anterior'));
  await waitFor(() => expect(screen.getByTestId('ruta').textContent).toBe('/panel'));
});

afterEach(()=>cleanup());
it('permite elegir área y navegar a la consulta sin escribir ni confirmar operaciones',async()=>{localStorage.clear();function Ruta(){const l=useLocation();return <output data-testid="actual">{l.pathname+l.search}</output>;}render(<MemoryRouter><Ruta/><RecorridoInicial usuarioId={4} roles={['FINANZAS']} pasos={[{titulo:'Panel',descripcion:'',destino:'/'}]} areas={[{id:'finanzas',titulo:'Finanzas y cobranza',resumen:'Guía especializada',pasos:[{titulo:'Revisar cargos',descripcion:'Solo consulta',destino:'/finanzas?vista=cargos',comprobar:'Verifica alumno'}]}]}/></MemoryRouter>);fireEvent.click(screen.getByRole('button',{name:/Finanzas y cobranza/}));await waitFor(()=>expect(screen.getByTestId('actual').textContent).toBe('/finanzas?vista=cargos'));expect(screen.getByText('Verifica alumno')).toBeTruthy();fireEvent.keyDown(screen.getByRole('complementary'),{key:'Escape'});expect(screen.queryByRole('complementary')).toBeNull();});
