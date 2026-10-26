import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { api } from '../api/client';
import AsistenciasPage from './Asistencias';
const auth = vi.hoisted(() => ({ roles: ['ALUMNO'] }));
vi.mock('../auth/AuthContext', () => ({ useAuth: () => ({ sesion: auth }) }));
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  auth.roles = ['ALUMNO'];
});
it('el alumno consulta su asistencia sin controles ni consultas de captura', async () => {
  const get = vi
    .spyOn(api, 'get')
    .mockResolvedValue({
      data: { datos: [{ id: 1, fecha: '2026-10-26', estado: 'PRESENTE', materia: 'Matemáticas', grupo: 'A' }] },
    });
  render(<AsistenciasPage />);
  await screen.findByText('PRESENTE');
  expect(screen.queryByText('Guardar asistencias')).toBeNull();
  expect(get.mock.calls.every(([ruta]) => ruta === '/asistencias')).toBe(true);
});
it('la consulta administrativa respeta puedeCapturar del servidor', async () => {
  auth.roles = ['ADMINISTRATIVO'];
  vi.spyOn(api, 'get').mockImplementation(async (ruta) => ({
    data:
      ruta === '/asistencias/clases'
        ? [{ id: 1, nombre: 'A · Matemáticas' }]
        : ruta === '/asistencias/lista'
          ? {
              revision: 'a'.repeat(64),
              puedeCapturar: false,
              alumnos: [{ id: 2, matricula: 'A2', nombre: 'Alumno', estado: 'PRESENTE' }],
            }
          : { datos: [] },
  }));
  render(<AsistenciasPage />);
  await screen.findByText('A · Matemáticas');
  fireEvent.change(screen.getByLabelText('Clase'), { target: { value: '1' } });
  await waitFor(() => expect((screen.getByLabelText('Asistencia de Alumno') as HTMLSelectElement).disabled).toBe(true));
  expect(screen.queryByText('Guardar asistencias')).toBeNull();
});
