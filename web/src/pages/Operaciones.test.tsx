import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { api } from '../api/client';
import OperacionesPage from './Operaciones';

vi.mock('../auth/AuthContext', () => ({ useAuth: () => ({ tieneRol: () => true }) }));
vi.mock('../components/BitacoraAcademica', () => ({ BitacoraAcademica: () => null }));
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

it.each([
  { archivo: new File([], 'lote.csv'), mensaje: /contener datos/ },
  { archivo: new File(['datos'], 'lote.exe'), mensaje: /CSV o Excel/ },
  { archivo: new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'lote.xlsx'), mensaje: /5 MB/ },
])('rechaza $archivo.name antes de enviarlo a la API', async ({ archivo: file, mensaje }) => {
  vi.spyOn(api, 'get').mockImplementation(async ruta => ({ data: ruta === '/academico/ciclos' ? [] : { datos: [], total: 0 } }));
  const post = vi.spyOn(api, 'post');
  render(<OperacionesPage />);
  await waitFor(() => expect(screen.getByLabelText('Tipo')).toBeTruthy());
  const archivo = screen.getByLabelText('Archivo');
  fireEvent.change(archivo, { target: { files: [file] } });
  fireEvent.submit(screen.getByRole('button', { name: 'Previsualizar archivo' }).closest('form')!);
  expect(screen.getByRole('alert').textContent).toMatch(mensaje);
  expect(post).not.toHaveBeenCalled();
});
it('cambiar de importación obliga a elegir nuevamente el archivo', async () => {
  vi.spyOn(api, 'get').mockImplementation(async ruta => ({ data: ruta === '/academico/ciclos' ? [] : { datos: [], total: 0 } }));
  render(<OperacionesPage />);
  const archivo = screen.getByLabelText('Archivo');
  fireEvent.change(archivo, { target: { files: [new File(['matricula'], 'alumnos.csv')] } });
  expect((screen.getByRole('button', { name: 'Previsualizar archivo' }) as HTMLButtonElement).disabled).toBe(false);
  fireEvent.change(screen.getByLabelText('Tipo'), { target: { value: 'DOCENTES' } });
  expect((screen.getByRole('button', { name: 'Previsualizar archivo' }) as HTMLButtonElement).disabled).toBe(true);
});

it('explica dónde consultar los IDs del plantel y del grupo', () => {
  vi.spyOn(api, 'get').mockImplementation(async ruta => ({ data: ruta === '/academico/ciclos' ? [] : { datos: [], total: 0 } }));
  render(<OperacionesPage />);
  expect(screen.getByText(/identificadores numéricos/)).toBeTruthy();
  expect(screen.getByRole('link', { name: 'Planteles' }).getAttribute('href')).toBe('/planteles?vista=consulta');
  expect(screen.getByRole('link', { name: 'Grupos' }).getAttribute('href')).toBe('/grupos?vista=consulta');
});

it('presenta por separado los válidos, existentes e inválidos de la importación parcial', async () => {
  vi.spyOn(api, 'get').mockImplementation(async ruta => ({ data: ruta === '/academico/ciclos' ? [] : { datos: [], total: 0 } }));
  vi.spyOn(api, 'post').mockResolvedValue({ data: {
    previewId: 'parcial', registros: 3, validos: 1,
    duplicados: [{ fila: 3, mensaje: 'Ya registrado: matrícula' }],
    errores: [{ fila: 4, mensaje: 'Falta proveedor' }], regla: 'Solo nuevos válidos',
    identificadores: [{ fila: 2, identificador: 'NUEVO' }],
  } });
  render(<OperacionesPage />);
  fireEvent.change(screen.getByLabelText('Archivo'), { target: { files: [new File(['datos'], 'alumnos.csv')] } });
  fireEvent.submit(screen.getByRole('button', { name: 'Previsualizar archivo' }).closest('form')!);
  await screen.findByText('1 nuevos válidos');
  expect(screen.getByText(/ya registrados o repetidos/)).toBeTruthy();
  expect(screen.getByText('Fila 4: Falta proveedor')).toBeTruthy();
  expect(screen.getByRole('region', { name: 'Filas de previsualización' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Importar 1 alumnos nuevos' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Descargar únicamente alumnos por corregir' })).toBeTruthy();
});

 it('descarta el resultado anterior si falla una nueva previsualización', async () => {
  vi.spyOn(api, 'get').mockResolvedValue({ data: [] });
  const post = vi.spyOn(api, 'post').mockResolvedValueOnce({ data: {
    previewId: 'anterior', registros: 1, validos: 1, duplicados: [], errores: [], regla: '', identificadores: [],
  } }).mockRejectedValueOnce(new Error('Sin conexión'));
  render(<OperacionesPage />);
  fireEvent.change(screen.getByLabelText('Archivo'), { target: { files: [new File(['datos'], 'lote.csv')] } });
  const form = screen.getByRole('button', { name: 'Previsualizar archivo' }).closest('form')!;
  fireEvent.submit(form);
  await screen.findByRole('button', { name: 'Importar 1 alumnos nuevos' });
  fireEvent.submit(form);
  await waitFor(() => expect(post).toHaveBeenCalledTimes(2));
  await screen.findByRole('alert');
  expect(screen.queryByRole('region', { name: 'Resultado de la previsualización' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Importar 1 alumnos nuevos' })).toBeNull();
});

it('bloquea archivo y tipo mientras se confirma y permite cancelar sin importar', async () => {
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, writable: true, value() {} });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, writable: true, value() {} });
  vi.spyOn(HTMLDialogElement.prototype, 'showModal').mockImplementation(function (this: HTMLDialogElement) { this.setAttribute('open', ''); });
  vi.spyOn(HTMLDialogElement.prototype, 'close').mockImplementation(function (this: HTMLDialogElement) { this.removeAttribute('open'); });
  vi.spyOn(api, 'get').mockResolvedValue({ data: [] });
  const post = vi.spyOn(api, 'post').mockResolvedValue({ data: {
    previewId: 'lote', registros: 1, validos: 1, duplicados: [], errores: [], regla: '', identificadores: [],
  } });
  render(<OperacionesPage />);
  fireEvent.change(screen.getByLabelText('Archivo'), { target: { files: [new File(['datos'], 'lote.csv')] } });
  fireEvent.submit(screen.getByRole('button', { name: 'Previsualizar archivo' }).closest('form')!);
  fireEvent.click(await screen.findByRole('button', { name: 'Importar 1 alumnos nuevos' }));
  await screen.findByRole('dialog');
  expect((screen.getByLabelText('Tipo') as HTMLSelectElement).disabled).toBe(true);
  expect((screen.getByLabelText('Archivo') as HTMLInputElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: /^Cancelar$/ }));
  await waitFor(() => expect((screen.getByLabelText('Tipo') as HTMLSelectElement).disabled).toBe(false));
  expect(post).toHaveBeenCalledTimes(1);
  expect(post).toHaveBeenCalledWith('/importaciones/preview', expect.any(FormData));
});
