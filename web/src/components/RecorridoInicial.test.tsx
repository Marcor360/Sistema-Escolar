import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Link, useLocation } from 'react-router-dom';
import { expect, it } from 'vitest';
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
