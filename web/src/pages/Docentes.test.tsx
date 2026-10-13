import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { api } from '../api/client';
import DocentesPage from './Docentes';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function pendiente() {
  let resolver!: (value: { data: unknown }) => void;
  const promesa = new Promise<{ data: unknown }>((resolve) => { resolver = resolve; });
  return { promesa, resolver };
}

const docentes = [1, 2].map((id) => ({
  id,
  numEmpleado: `EMP-${id}`,
  estatus: 'ACTIVO',
  planteles: ['Centro'],
  usuario: { nombre: `Docente ${id}`, apellidoPaterno: 'Prueba', email: `docente${id}@example.test` },
}));

const respuesta = { datos: docentes, pagina: 1, porPagina: 20, total: 2 };

it('mostrar clases del segundo docente no permite que una respuesta anterior sobrescriba el detalle', async () => {
  const antigua = pendiente();
  const reciente = pendiente();
  vi.spyOn(api, 'get').mockImplementation((url) => {
    if (url === '/docentes') return Promise.resolve({ data: respuesta });
    if (url === '/planteles/mios') return Promise.resolve({ data: [{ id: 1, nombre: 'Centro' }] });
    if (url === '/docentes/1') return antigua.promesa;
    if (url === '/docentes/2') return reciente.promesa;
    throw new Error('Ruta inesperada');
  });

  render(<DocentesPage />);
  await screen.findByText('EMP-1');
  const acciones = screen.getAllByRole('button', { name: 'Planteles y clases' });
  fireEvent.click(acciones[0]);
  expect(screen.getByText('Cargando planteles y clases del docente…')).toBeTruthy();
  fireEvent.click(acciones[1]);
  await act(async () => reciente.resolver({ data: {
    id: 2, estatus: 'ACTIVO', plantelIds: [1],
    clases: [{ id: 20, grupo: 'G2', materia: 'Segunda materia', ciclo: '2026', plantel: 'Centro', vigente: true }],
  } }));
  expect(screen.getByText(/Segunda materia/)).toBeTruthy();
  await act(async () => antigua.resolver({ data: {
    id: 1, estatus: 'ACTIVO', plantelIds: [1],
    clases: [{ id: 10, grupo: 'G1', materia: 'Materia antigua', ciclo: '2026', plantel: 'Centro', vigente: true }],
  } }));
  expect(screen.getByText(/Segunda materia/)).toBeTruthy();
  expect(screen.queryByText(/Materia antigua/)).toBeNull();
  expect(screen.queryByText('Cargando planteles y clases del docente…')).toBeNull();
});
