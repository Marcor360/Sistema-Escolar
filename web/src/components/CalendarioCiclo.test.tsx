import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { api } from '../api/client';
import { CalendarioCiclo } from './CalendarioCiclo';
const auth = vi.hoisted(() => ({ roles: ['ALUMNO'] }));
vi.mock('../auth/AuthContext', () => ({ useAuth: () => ({ sesion: auth }) }));
afterEach(() => {
  auth.roles = ['ALUMNO'];
  cleanup();
  vi.restoreAllMocks();
});
it('construye los doce meses del ciclo y permite consultar un mes con sus fechas', async () => {
  vi.spyOn(api, 'get').mockImplementation(async (ruta) => ({
    data: String(ruta).endsWith('/opciones')
      ? { ciclos: [{ id: 1, nombre: '2026-2027', fechaInicio: '2026-08-01', fechaFin: '2027-07-31' }], niveles: [] }
      : [
          {
            id: 1,
            titulo: 'Inicio de clases',
            fechaInicio: '2026-09-10T12:00:00Z',
            fechaFin: null,
            imagenNombre: null,
            audiencia: 'ACADEMICA',
          },
        ],
  }));
  render(<CalendarioCiclo />);
  await screen.findByText('Inicio de clases', {}, { timeout: 5000 });
  expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(12);
  fireEvent.change(screen.getByLabelText('Vista'), { target: { value: 'mes' } });
  fireEvent.change(screen.getByLabelText('Mes'), { target: { value: '2026-09' } });
  expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(1);
  expect(screen.getByText('Inicio de clases')).toBeTruthy();
  expect(screen.queryByText('Publicar evento o imagen del ciclo')).toBeNull();
});

it('publica una imagen del ciclo con nivel y audiencia financiera', async () => {
  auth.roles = ['FINANZAS'];
  vi.spyOn(api, 'get').mockImplementation(async (ruta) => ({
    data: String(ruta).endsWith('/opciones')
      ? {
          ciclos: [{ id: 3, nombre: '2026', fechaInicio: '2026-01-01', fechaFin: '2026-12-31' }],
          niveles: [{ id: 7, nombre: 'Secundaria', plantelId: 2 }],
        }
      : [],
  }));
  const post = vi.spyOn(api, 'post').mockResolvedValue({ data: { id: 1 } });
  render(<CalendarioCiclo />);
  await screen.findByRole('heading', { name: 'enero de 2026' });
  fireEvent.change(screen.getByLabelText('Nivel académico'), { target: { value: '7' } });
  fireEvent.change(screen.getByLabelText('Título del calendario o evento'), { target: { value: 'Cortes anuales' } });
  fireEvent.change(screen.getByLabelText('Visibilidad'), { target: { value: 'FINANCIERA' } });
  fireEvent.change(screen.getByLabelText(/Imagen opcional/), {
    target: { files: [new File(['png'], 'ciclo.png', { type: 'image/png' })] },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Publicar imagen del ciclo' }));
  await vi.waitFor(() => expect(post).toHaveBeenCalledTimes(1));
  expect(post.mock.calls[0][0]).toBe('/calendario/imagen');
  const form = post.mock.calls[0][1] as FormData;
  expect(form.get('cicloId')).toBe('3');
  expect(form.get('nivelId')).toBe('7');
  expect(form.get('plantelId')).toBe('2');
  expect(form.get('audiencia')).toBe('FINANCIERA');
  expect(form.get('fechaInicio')).toBe('2026-01-01T00:00:00-06:00');
  expect(form.get('fechaFin')).toBe('2026-12-31T23:59:59-06:00');
  await vi.waitFor(() => expect((screen.getByLabelText('Título del calendario o evento') as HTMLInputElement).value).toBe(''));
  expect((screen.getByLabelText(/Imagen opcional/) as HTMLInputElement).value).toBe('');
  expect(screen.getByLabelText('Fecha')).toBeTruthy();
});
it('muestra el fallo al consultar opciones', async () => {
  vi.spyOn(api, 'get').mockRejectedValue(new Error('Sin conexión'));
  render(<CalendarioCiclo />);
  expect(await screen.findByRole('alert')).toBeTruthy();
});
