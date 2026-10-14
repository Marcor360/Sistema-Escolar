import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import CalendarioPage from './Calendario';
import { api } from '../api/client';
import { intervaloDias } from '../utils/formato';
const contexto = vi.hoisted(() => ({ roles: ['SUPERADMIN'], sub: 1 }));
vi.mock('../auth/AuthContext', () => ({ useAuth: () => ({ sesion: contexto }) }));
afterEach(() => { cleanup(); vi.restoreAllMocks(); contexto.roles = ['SUPERADMIN']; contexto.sub = 1; });
it('conserva intervalo aplicado al recargar tras crear y bloquea envíos duplicados', async () => {
  const get = vi.spyOn(api, 'get').mockResolvedValue({ data: [] });
  let terminar!: (valor: { data: object }) => void;
  const post = vi.spyOn(api, 'post').mockImplementation(() => new Promise((resolve) => { terminar = resolve; }));
  render(<CalendarioPage />); await waitFor(() => expect((screen.getByText('Consultar intervalo') as HTMLButtonElement).disabled).toBe(false));
  fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '' } }); fireEvent.click(screen.getByText('Consultar intervalo')); await screen.findByRole('alert');
  fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2027-01-05' } }); fireEvent.change(screen.getByLabelText('Hasta'), { target: { value: '2027-01-06' } }); fireEvent.click(screen.getByText('Consultar intervalo'));
  await waitFor(() => expect(get).toHaveBeenCalledWith('/calendario', { params: intervaloDias('2027-01-05','2027-01-06') }));
  fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Evento' } }); fireEvent.change(screen.getByLabelText('Inicio'), { target: { value: '2027-01-05T10:00' } });
  const formulario = screen.getByLabelText('Título').closest('form')!; fireEvent.submit(formulario); fireEvent.submit(formulario);
  expect(post).toHaveBeenCalledTimes(1); expect((screen.getByText('Guardando…') as HTMLButtonElement).disabled).toBe(true);
  terminar({ data: {} }); await waitFor(() => expect((screen.getByLabelText('Título') as HTMLInputElement).value).toBe(''));
  const consultas = get.mock.calls.filter(([url]) => url === '/calendario'); expect(consultas[consultas.length - 1]?.[1]).toEqual({ params: intervaloDias('2027-01-05','2027-01-06') });
});


it('el maestro solo ve Eliminar en los eventos que creó', async () => {
  contexto.roles = ['MAESTRO'];
  contexto.sub = 7;
  const eventos = [
    { id: 10, titulo: 'Aviso global', creadoPorId: 99, fechaInicio: '2026-10-20T10:00:00Z', fechaFin: null, descripcion: null, tipo: 'GENERAL', plantel: null },
    { id: 11, titulo: 'Examen del docente', creadoPorId: 7, fechaInicio: '2026-10-21T10:00:00Z', fechaFin: null, descripcion: null, tipo: 'EXAMEN', plantel: { id: 1, nombre: 'Centro' } },
  ];
  vi.spyOn(api, 'get').mockImplementation(async (url) => ({
    data: url === '/calendario' ? eventos : [],
  }));
  render(<CalendarioPage />);
  await screen.findByText('Aviso global');
  expect(screen.getAllByRole('button', { name: 'Eliminar' })).toHaveLength(1);
  expect(screen.getByText('Solo lectura')).toBeTruthy();
});

it.each([
  { roles: ['ADMINISTRATIVO'], autorizados: 1 },
  { roles: ['ADMINISTRATIVO', 'MAESTRO'], autorizados: 1 },
  { roles: ['MAESTRO', 'FINANZAS'], autorizados: 1 },
  { roles: ['SUPERADMIN'], autorizados: 3 },
  { roles: ['FINANZAS'], autorizados: 0 },
])('respeta autorización para $roles', async ({ roles, autorizados }) => {
  contexto.roles = roles; contexto.sub = 7;
  const eventos = [
    { id: 1, titulo: 'Evento global institucional', creadoPorId: 99, plantel: null },
    { id: 2, titulo: 'Sede propia', creadoPorId: 7, plantel: { id: 1, nombre: 'Centro' } },
    { id: 3, titulo: 'Otra sede', creadoPorId: 99, plantel: { id: 2, nombre: 'Otro' } },
  ].map((evento) => ({ ...evento, fechaInicio: '2026-10-20T10:00:00Z', fechaFin: null, descripcion: null, tipo: 'GENERAL' }));
  vi.spyOn(api, 'get').mockImplementation(async (url) => ({ data: url === '/calendario'
    ? eventos : url === '/planteles/mios' ? [{ id: 1, nombre: 'Centro' }] : [] }));
  render(<CalendarioPage />); await screen.findByText('Evento global institucional');
  await waitFor(() => expect(screen.queryAllByRole('button', { name: 'Eliminar' })).toHaveLength(autorizados));
  expect(screen.queryAllByText('Solo lectura')).toHaveLength(3 - autorizados);
});

it('envía una edición con revisión y conserva datos ante conflicto', async () => {
  const evento = { id: 1, revision: 'a'.repeat(64), grupoId: null, creadoPorId: 1, titulo: 'Examen', descripcion: '', tipo: 'EXAMEN', fechaInicio: '2026-10-20T10:00:00Z', fechaFin: null, plantel: { id: 1, nombre: 'Centro' } };
  vi.spyOn(api, 'get').mockImplementation(async (url) => ({ data: url === '/calendario' ? [evento] : url === '/planteles/mios' ? [{ id: 1, nombre: 'Centro' }] : [] }));
  const patch = vi.spyOn(api, 'patch').mockRejectedValue(new Error('Conflicto'));
  render(<CalendarioPage />); await screen.findByText('Examen');
  fireEvent.click(screen.getByRole('button', { name: 'Editar' }));
  fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Examen corregido' } });
  fireEvent.submit(screen.getByLabelText('Título').closest('form')!);
  await screen.findByRole('alert');
  expect(patch).toHaveBeenCalledWith('/calendario/1', expect.objectContaining({ revision: evento.revision, titulo: 'Examen corregido' }));
  expect((screen.getByLabelText('Título') as HTMLInputElement).value).toBe('Examen corregido');
});
