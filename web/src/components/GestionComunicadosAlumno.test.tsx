import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { api } from '../api/client';
import { GestionComunicadosAlumno } from './GestionComunicadosAlumno';

const sede = { id: 3, nombre: 'Plantel Prueba' };
const borrador = {
  id: 12, plantelId: 3, titulo: 'Aviso de prueba', mensaje: 'Consulta el calendario.',
  estado: 'BORRADOR', destinatarios: 0, enviadoEn: null,
};
const listado = { datos: [borrador], total: 1, pagina: 1, porPagina: 10 };

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it('distingue error de consulta de catálogo vacío y permite reintentar', async () => {
  let fallos = 0;
  vi.spyOn(api, 'get').mockImplementation(async (ruta) => {
    if (ruta === '/planteles/mios') return { data: [sede] };
    if (++fallos === 1) throw new Error('La red no responde');
    return { data: { datos: [], total: 0, pagina: 1, porPagina: 10 } };
  });
  render(<GestionComunicadosAlumno />);
  expect((await screen.findByRole('alert')).textContent).toContain('No se pudieron consultar los comunicados');
  expect(screen.queryByText('No hay comunicados en los planteles autorizados.')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Reintentar consulta' }));
  expect(await screen.findByText('No hay comunicados en los planteles autorizados.')).toBeTruthy();
  expect(screen.queryByRole('alert')).toBeNull();
  expect(fallos).toBe(2);
});

it('exige confirmación antes de publicar y no envía nada cuando se cancela', async () => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
  vi.spyOn(api, 'get').mockImplementation(async (ruta) =>
    ruta === '/planteles/mios' ? { data: [sede] } : { data: listado });
  const publicar = vi.spyOn(api, 'post').mockImplementation(async (ruta) => {
    if (ruta.endsWith('/preview')) return { data: { destinatarios: 3, excedeLimite: false } };
    if (ruta.endsWith('/publicar')) return { data: { enviadas: 3, repetido: false } };
    throw new Error('Acción inesperada');
  });
  render(<GestionComunicadosAlumno />);
  fireEvent.click(await screen.findByRole('button', { name: 'Revisar y publicar' }));
  const dialogo = await screen.findByRole('dialog');
  expect(dialogo.textContent).toContain('3 alumnos activos');
  expect(publicar.mock.calls.filter(([ruta]) => ruta.endsWith('/publicar'))).toHaveLength(0);
  fireEvent.click(within(dialogo).getByRole('button', { name: 'Cancelar' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  expect(publicar.mock.calls.filter(([ruta]) => ruta.endsWith('/publicar'))).toHaveLength(0);
  await waitFor(() => expect((screen.getByRole('button', { name: 'Revisar y publicar' }) as HTMLButtonElement).disabled).toBe(false));
  fireEvent.click(screen.getByRole('button', { name: 'Revisar y publicar' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Publicar comunicado' }));
  await screen.findByText('Comunicado publicado a 3 alumnos.');
  expect(publicar.mock.calls.filter(([ruta]) => ruta.endsWith('/publicar'))).toHaveLength(1);
});

it('no ofrece volver a crear el borrador cuando guardar tuvo éxito pero falló el refresco', async () => {
  let lecturas = 0;
  vi.spyOn(api, 'get').mockImplementation(async (ruta) => {
    if (ruta === '/planteles/mios') return { data: [sede] };
    if (++lecturas === 1) return { data: listado };
    throw Object.assign(new Error('Red interrumpida al actualizar'), { code: 'ERR_NETWORK' });
  });
  const crear = vi.spyOn(api, 'post').mockResolvedValue({ data: { id: 23 } });
  render(<GestionComunicadosAlumno />);
  await screen.findByRole('button', { name: 'Revisar y publicar' });
  fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Recordatorio' } });
  fireEvent.change(screen.getByLabelText('Mensaje'), { target: { value: 'Revisa tus pendientes.' } });
  fireEvent.submit(screen.getByLabelText('Título').closest('form')!);
  expect(await screen.findByText('Borrador guardado. No se ha enviado ninguna notificación.')).toBeTruthy();
  const alerta = (await screen.findByRole('alert')).textContent;
  expect(alerta).toContain('Revisa tu conexión');
  expect(alerta).not.toContain('Red interrumpida al actualizar');
  expect(screen.getByRole('button', { name: 'Reintentar consulta' })).toBeTruthy();
  expect(crear).toHaveBeenCalledTimes(1);
  expect((screen.getByLabelText('Título') as HTMLInputElement).value).toBe('');
});
