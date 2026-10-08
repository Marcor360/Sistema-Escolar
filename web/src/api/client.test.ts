import { afterEach, expect, it, vi } from 'vitest';
import { abrirArchivo, api, archivosBase } from './client';
afterEach(() => vi.restoreAllMocks());
it('abre pestaña antes de esperar el enlace firmado y elimina acceso al opener', async () => {
  const replace = vi.fn(), close = vi.fn(); const pestaña = { opener: window, location: { replace }, close };
  const open = vi.spyOn(window, 'open').mockReturnValue(pestaña as unknown as Window);
  let terminar!: (resultado: { data: { url: string } }) => void;
  const get = vi.spyOn(api, 'get').mockImplementation(() => new Promise((resolve) => { terminar = resolve; }));
  const promesa = abrirArchivo('materiales', 3);
  expect(open).toHaveBeenCalledWith('about:blank', '_blank'); expect(pestaña.opener).toBeNull(); expect(get).toHaveBeenCalledWith('/archivos/materiales/3/enlace'); expect(replace).not.toHaveBeenCalled();
  terminar({ data: { url: '/api/archivos/materiales/3?t=firmado' } }); await promesa;
  expect(replace).toHaveBeenCalledWith(`${archivosBase}/api/archivos/materiales/3?t=firmado`); expect(close).not.toHaveBeenCalled();
});
it('no solicita enlace cuando el navegador bloquea la pestaña; cierra la pestaña si falla API', async () => {
  const open = vi.spyOn(window, 'open').mockReturnValue(null); const get = vi.spyOn(api, 'get').mockRejectedValue(new Error('Sin acceso'));
  await expect(abrirArchivo('entregas', 3)).rejects.toThrow('Permite'); expect(get).not.toHaveBeenCalled();
  const close = vi.fn(); open.mockReturnValue({ location: { replace: vi.fn() }, close } as unknown as Window);
  await expect(abrirArchivo('entregas', 3)).rejects.toThrow('Sin acceso'); expect(close).toHaveBeenCalledOnce();
});
