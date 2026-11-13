import { cleanup, render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Link, useLocation } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import { api } from '../api/client';
vi.mock('../api/client', () => ({ api: { get: vi.fn() } }));
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

it.each([true, false])('consulta acceso previo del alumno: %s', async (accesoPrevio) => {
  localStorage.clear();
  vi.mocked(api.get).mockResolvedValueOnce({ data: { accesoPrevio } });
  render(<MemoryRouter><RecorridoInicial usuarioId={23} roles={['ALUMNO']} pasos={[{ titulo: 'Inicio alumno', descripcion: '', destino: '/inicio' }]} /></MemoryRouter>);
  await waitFor(() => expect(api.get).toHaveBeenCalledWith('/auth/me'));
  if (accesoPrevio) expect(screen.queryByRole('complementary')).toBeNull();
  else await waitFor(() => expect(screen.getByRole('complementary')).toBeTruthy());
  fireEvent(window, new Event('escolar:reiniciar-recorrido'));
  expect(screen.getByRole('complementary')).toBeTruthy();
});

it('permite elegir un paso, reducir la guía y retomarla sin forzar el regreso', async () => {
  localStorage.clear();
  function Ruta() { const l = useLocation(); return <output data-testid="ruta-guia">{l.pathname + l.search}</output>; }
  render(<MemoryRouter><Ruta /><Link to="/otra">Otra pantalla</Link><RecorridoInicial usuarioId={90} roles={['MAESTRO']} pasos={[
    { titulo: 'Consultar clases', descripcion: 'Selecciona tu clase', destino: '/maestro?vista=consulta' },
    { titulo: 'Consultar notas', descripcion: 'Revisa las notas', destino: '/calificaciones?vista=consulta' },
  ]} /></MemoryRouter>);
  fireEvent.change(screen.getByLabelText('Ir a un paso'), { target: { value: '1' } });
  await waitFor(() => expect(screen.getByTestId('ruta-guia').textContent).toBe('/calificaciones?vista=consulta'));
  fireEvent.click(screen.getByRole('button', { name: 'Reducir guía' }));
  fireEvent.click(screen.getByText('Otra pantalla'));
  fireEvent.click(screen.getByRole('button', { name: 'Continuar guía' }));
  expect(screen.getByTestId('ruta-guia').textContent).toBe('/otra');
  expect(screen.getByRole('heading', { name: 'Consultar notas' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Abrir pantalla del paso' }));
  await waitFor(() => expect(screen.getByTestId('ruta-guia').textContent).toBe('/calificaciones?vista=consulta'));
});
