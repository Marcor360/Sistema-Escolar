import { afterEach, expect, it, vi } from 'vitest';
import { MAX_LOGO_ORIGINAL_BYTES, MAX_LOGO_WEBP_BYTES, optimizarLogo } from './optimizar-logo';

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

it('rechaza imagen de más de 20 MiB antes de decodificarla', async () => {
  const crear = vi.fn();
  vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: crear }));
  await expect(optimizarLogo(new File([new Uint8Array(MAX_LOGO_ORIGINAL_BYTES + 1)], 'logo.png'))).rejects.toThrow('20 MB');
  expect(crear).not.toHaveBeenCalled();
});

it('transforma un PNG a WebP, reduce dimensiones y revoca la URL', async () => {
  const crear = vi.fn(() => 'blob:imagen');
  const revocar = vi.fn();
  vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: crear, revokeObjectURL: revocar }));
  class ImagenFalsa {
    naturalWidth = 4000;
    naturalHeight = 2000;
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    set src(_url: string) { this.onload?.(); }
  }
  vi.stubGlobal('Image', ImagenFalsa);
  const dibujar = vi.fn();
  const lienzo = {
    width: 0, height: 0,
    getContext: () => ({ clearRect: vi.fn(), drawImage: dibujar }),
    toBlob: (cb: (archivo: Blob | null) => void) => cb(new Blob(['resultado'], { type: 'image/webp' })),
  };
  const crearElemento = document.createElement.bind(document);
  vi.spyOn(document, 'createElement').mockImplementation(((tag: string) => tag === 'canvas' ? lienzo : crearElemento(tag)) as typeof document.createElement);
  const salida = await optimizarLogo(new File(['entrada'], 'logo.png'));
  expect(salida.name).toBe('logo-institucional.webp');
  expect(salida.type).toBe('image/webp');
  expect(salida.size).toBeLessThanOrEqual(MAX_LOGO_WEBP_BYTES);
  expect(lienzo.width).toBe(2048);
  expect(lienzo.height).toBe(1024);
  expect(dibujar).toHaveBeenCalledTimes(1);
  expect(revocar).toHaveBeenCalledWith('blob:imagen');
});

it('rechaza archivos falsos al fallar la decodificación y libera la URL', async () => {
  const revocar = vi.fn();
  vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: () => 'blob:roto', revokeObjectURL: revocar }));
  class ImagenRota {
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    set src(_url: string) { this.onerror?.(); }
  }
  vi.stubGlobal('Image', ImagenRota);
  await expect(optimizarLogo(new File(['falso'], 'logo.png'))).rejects.toThrow('No se puede abrir');
  expect(revocar).toHaveBeenCalledWith('blob:roto');
});
