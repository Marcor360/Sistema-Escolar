import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import ConfiguracionPage from './Configuracion';
import { api } from '../api/client';
vi.mock('../utils/crear-logo-pdf', () => ({ crearLogoPdfPng: vi.fn(async () => new File(['png'], 'logo-pdf.png', { type: 'image/png' })) }));
vi.mock('../utils/optimizar-logo', () => ({ MAX_LOGO_ORIGINAL_BYTES: 20 * 1024 * 1024, optimizarLogo: vi.fn(async () => new File(['webp'], 'logo-institucional.webp', { type: 'image/webp' })) }));
const { recargar, marca } = vi.hoisted(() => ({ recargar: vi.fn(), marca: { nombreInstitucion: 'Escuela', nombreCorto: 'SE', colorPrimario: '#14343B', colorAcento: '#C79A3C', mensajeBienvenida: '', tamanoLogo: 'NORMAL' as 'NORMAL' | 'GRANDE', logoUrl: null as string | null } }));
vi.mock('../marca/MarcaContext', () => {
  return { useMarca: () => ({ marca, recargar }) };
});
beforeEach(() => { recargar.mockReset().mockResolvedValue(undefined); Object.assign(marca, { nombreInstitucion: 'Escuela', nombreCorto: 'SE', colorPrimario: '#14343B', colorAcento: '#C79A3C', mensajeBienvenida: '', tamanoLogo: 'NORMAL', logoUrl: null }); vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:logo'), revokeObjectURL: vi.fn() })); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
it('dos envíos inmediatos guardan una sola vez y anuncian el resultado', async () => {
  let terminar!: (r: { data: object }) => void;
  const put = vi.spyOn(api,'put').mockImplementation(() => new Promise((r) => { terminar = r; }));
  render(<ConfiguracionPage />); const form = screen.getByLabelText('Nombre de la institución').closest('form')!;
  fireEvent.submit(form); fireEvent.submit(form); expect(put).toHaveBeenCalledTimes(1); expect(form.getAttribute('aria-busy')).toBe('true');
  terminar({ data: {} }); await screen.findByRole('status'); expect(form.getAttribute('aria-busy')).toBe('false');
});
it('preserva la edición después de un fallo y permite reintentar', async () => {
  const put = vi.spyOn(api,'put').mockRejectedValueOnce(new Error('Red caída')).mockResolvedValue({ data: {} });
  render(<ConfiguracionPage />); const input = screen.getByLabelText('Nombre de la institución') as HTMLInputElement;
  fireEvent.change(input,{ target: { value: 'Nombre corregido' } }); fireEvent.submit(input.closest('form')!);
  await screen.findByRole('alert'); expect(input.value).toBe('Nombre corregido');
  await waitFor(() => expect((screen.getByText('Guardar cambios') as HTMLButtonElement).disabled).toBe(false));
  fireEvent.submit(input.closest('form')!); await screen.findByRole('status'); expect(put).toHaveBeenLastCalledWith('/configuracion/marca',expect.objectContaining({ nombreInstitucion: 'Nombre corregido' }));
});

it('rechaza localmente logos de más de 20 MB sin modificar la marca ni enviar el archivo', () => {
  const put = vi.spyOn(api, 'put');
  const post = vi.spyOn(api, 'post');
  render(<ConfiguracionPage />);
  const archivo = new File([new Uint8Array(20 * 1024 * 1024 + 1)], 'logo.png', { type: 'image/png' });
  fireEvent.change(screen.getByLabelText(/Logo \(PNG, JPG o WebP/), { target: { files: [archivo] } });
  expect(screen.getByRole('alert').textContent).toContain('supera los 20 MB');
  expect((screen.getByRole('button', { name: 'Guardar cambios' }) as HTMLButtonElement).disabled).toBe(true);
  expect(put).not.toHaveBeenCalled();
  expect(post).not.toHaveBeenCalled();
});

it('informa el guardado parcial y conserva el archivo para reintentar', async () => {
  vi.spyOn(api, 'put').mockResolvedValue({ data: {} });
  const post = vi.spyOn(api, 'post').mockRejectedValueOnce({ response: { status: 413, data: { message: 'File too large' } } }).mockResolvedValue({ data: { logoUrl: '/uploads/marca-logo-prueba.webp' } });
  vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 200, headers: { 'content-type': 'image/webp' } })));
  render(<ConfiguracionPage />);
  const input = screen.getByLabelText(/Logo \(PNG/) as HTMLInputElement;
  fireEvent.change(input, { target: { files: [new File(['png'], 'logo.png')] } });
  fireEvent.submit(input.closest('form')!);
  expect((await screen.findByRole('alert')).textContent).toContain('Los datos institucionales se guardaron, pero el logotipo no: El WebP optimizado supera los 10 MiB');
  await waitFor(() => expect((screen.getByText('Guardar cambios') as HTMLButtonElement).disabled).toBe(false));
  fireEvent.submit(input.closest('form')!);
  await screen.findByRole('status');
  expect(post).toHaveBeenCalledTimes(3);
  const primerForm = post.mock.calls[0][1] as FormData;
  expect((primerForm.get('logo') as File).type).toBe('image/webp');
});

it('no informa fallo de carga si el logo se guardó y falla la actualización de la vista', async () => {
  vi.spyOn(api, 'put').mockResolvedValue({ data: {} });
  vi.spyOn(api, 'post').mockResolvedValue({ data: { logoUrl: '/uploads/marca-logo-prueba.webp' } });
  vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 200, headers: { 'content-type': 'image/webp' } })));
  recargar.mockRejectedValueOnce(new Error('Sin conexión'));
  render(<ConfiguracionPage />);
  const input = screen.getByLabelText(/Logo \(PNG/);
  fireEvent.change(input, { target: { files: [new File(['png'], 'logo.png')] } });
  fireEvent.submit(input.closest('form')!);
  expect((await screen.findByRole('alert')).textContent).toContain('Los datos y el logotipo se guardaron');
});

it('distingue logo remoto de vista local dañada y bloquea el archivo dañado', () => {
  marca.logoUrl = '/uploads/marca-logo-anterior.png';
  render(<ConfiguracionPage />);
  fireEvent.error(screen.getByRole('img'));
  expect(screen.getByRole('alert').textContent).toContain('logotipo guardado');
  fireEvent.change(screen.getByLabelText(/Logo \(PNG/), { target: { files: [new File(['dañado'], 'logo.png')] } });
  fireEvent.error(screen.getByRole('img'));
  expect(screen.getByRole('alert').textContent).toContain('imagen seleccionada');
  expect((screen.getByText('Guardar cambios') as HTMLButtonElement).disabled).toBe(true);
});

it.each(['logo.exe', 'vacio.png'])('rechaza %s y permite reemplazarlo por una imagen al límite', (nombre) => {
  render(<ConfiguracionPage />);
  const input = screen.getByLabelText(/Logo \(PNG/);
  fireEvent.change(input, { target: { files: [new File(nombre === 'vacio.png' ? [] : ['exe'], nombre)] } });
  expect(screen.getByRole('alert').textContent).toContain('imagen PNG, JPG o WebP válida');
  fireEvent.change(input, { target: { files: [new File([new Uint8Array(20 * 1024 * 1024)], 'logo.png')] } });
  expect(screen.queryByRole('alert')).toBeNull();
  expect((screen.getByText('Guardar cambios') as HTMLButtonElement).disabled).toBe(false);
});


it('permite volver a abrir el tutorial desde Configuración sin guardar formularios', () => {
  const reiniciar = vi.fn();
  window.addEventListener('escolar:reiniciar-recorrido', reiniciar);
  const put = vi.spyOn(api, 'put');
  try {
    render(<ConfiguracionPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Ver nuevamente el tutorial' }));
    expect(reiniciar).toHaveBeenCalledTimes(1);
    expect(put).not.toHaveBeenCalled();
  } finally { window.removeEventListener('escolar:reiniciar-recorrido', reiniciar); }
});

it('conserva el borrador de opciones al guardar identidad y viceversa', async () => {
  vi.spyOn(api, 'put').mockResolvedValue({ data: {} });
  const { rerender } = render(<ConfiguracionPage />);
  const nombre = screen.getByLabelText('Nombre de la institución') as HTMLInputElement;
  const bienvenida = screen.getByLabelText('Mensaje institucional de bienvenida') as HTMLTextAreaElement;
  fireEvent.change(bienvenida, { target: { value: 'Borrador pendiente' } });
  fireEvent.change(nombre, { target: { value: 'Nombre guardado' } });
  recargar.mockImplementationOnce(async () => { marca.nombreInstitucion = 'Nombre guardado'; rerender(<ConfiguracionPage />); });
  fireEvent.submit(nombre.closest('form')!);
  await screen.findByText('Identidad institucional actualizada.');
  expect(bienvenida.value).toBe('Borrador pendiente');
  fireEvent.change(nombre, { target: { value: 'Otro borrador' } });
  recargar.mockImplementationOnce(async () => { marca.mensajeBienvenida = 'Borrador pendiente'; rerender(<ConfiguracionPage />); });
  fireEvent.submit(bienvenida.closest('form')!);
  await screen.findByText('Opciones globales guardadas.');
  expect(nombre.value).toBe('Otro borrador');
});

it('informa fallo de PNG sin afirmar que las fichas están listas y conserva el archivo', async () => {
  vi.spyOn(api, 'put').mockResolvedValue({ data: {} });
  const post = vi.spyOn(api, 'post').mockResolvedValueOnce({ data: { logoUrl: '/uploads/marca-logo-prueba.webp' } })
    .mockRejectedValueOnce({ response: { status: 413, data: { message: 'File too large' } } });
  render(<ConfiguracionPage/>);
  const input = screen.getByLabelText(/Logo \(PNG/) as HTMLInputElement;
  fireEvent.change(input, { target: { files: [new File(['png'], 'logo.png')] } });
  fireEvent.submit(input.closest('form')!);
  expect((await screen.findByRole('alert')).textContent).toContain('El PNG imprimible supera los 3 MiB');
  expect(post).toHaveBeenNthCalledWith(2, '/configuracion/marca/logo/pdf', expect.any(FormData));
  expect(input.files).toHaveLength(1);
  expect(screen.queryByText(/logo listo para portal/)).toBeNull();
});
