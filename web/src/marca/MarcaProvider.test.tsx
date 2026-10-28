import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { api } from '../api/client';
import { MARCA_CACHE_WEB, MarcaProvider, useMarca, type Marca } from './MarcaContext';

const identidad: Marca = {
  nombreInstitucion: 'Instituto desde servidor',
  nombreCorto: 'IUA',
  logoUrl: '/uploads/marca-logo-123abc.webp',
  colorPrimario: '#AA1122',
  colorPrimarioOscuro: '#771122',
  colorAcento: '#DDBB33',
  mensajeBienvenida: 'Bienvenido al portal',
  tamanoLogo: 'NORMAL',
  actualizadoEn: '2026-10-21T09:00:00Z',
};

function LeerMarca() {
  const { marca } = useMarca();
  return <p>{marca.nombreInstitucion} - {marca.logoUrl ?? 'sin logo'} - {marca.colorPrimario}</p>;
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  localStorage.removeItem(MARCA_CACHE_WEB);
});

it('muestra la última marca pública de caché y la sustituye al consultar la API', async () => {
  const anterior = { ...identidad, nombreInstitucion: 'Instituto desde caché', logoUrl: null };
  localStorage.setItem(MARCA_CACHE_WEB, JSON.stringify(anterior));
  const get = vi.spyOn(api, 'get').mockResolvedValue({ data: identidad });
  render(<MarcaProvider><LeerMarca /></MarcaProvider>);
  expect(screen.getByText(/Instituto desde caché/)).toBeTruthy();
  await screen.findByText(/Instituto desde servidor/);
  expect(get).toHaveBeenCalledWith('/configuracion/marca');
  expect(get).toHaveBeenCalledTimes(1);
  expect(JSON.parse(localStorage.getItem(MARCA_CACHE_WEB) ?? '{}').logoUrl).toBe(identidad.logoUrl);
});

it('revalida en foco y recibe cambios públicos de otra pestaña sin recargar la página', async () => {
  const get = vi.spyOn(api, 'get').mockResolvedValue({ data: identidad });
  render(<MarcaProvider><LeerMarca /></MarcaProvider>);
  await screen.findByText(/Instituto desde servidor/);
  const vigente = { ...identidad, nombreInstitucion: 'Instituto actualizado', colorPrimario: '#001122' };
  get.mockResolvedValue({ data: vigente });
  act(() => { window.dispatchEvent(new Event('focus')); });
  await screen.findByText(/Instituto actualizado/);
  await waitFor(() => expect(JSON.parse(localStorage.getItem(MARCA_CACHE_WEB) ?? '{}').colorPrimario).toBe('#001122'));

  const otraPestana = { ...vigente, nombreInstitucion: 'Instituto otra pestaña', logoUrl: null };
  act(() => {
    window.dispatchEvent(new StorageEvent('storage', {
      key: MARCA_CACHE_WEB,
      newValue: JSON.stringify(otraPestana),
    }));
  });
  expect(screen.getByText(/Instituto otra pestaña/)).toBeTruthy();
  expect(document.title).toBe('Instituto otra pestaña — Panel');
  expect(document.documentElement.style.getPropertyValue('--pizarra')).toBe(otraPestana.colorPrimario);
  expect(get).toHaveBeenCalledTimes(2);
});

it('ante fallo de red conserva la identidad cacheada y no borra logo ni colores', async () => {
  localStorage.setItem(MARCA_CACHE_WEB, JSON.stringify(identidad));
  vi.spyOn(api, 'get').mockRejectedValue(new Error('Sin conexión'));
  render(<MarcaProvider><LeerMarca /></MarcaProvider>);
  await screen.findByText(/Instituto desde servidor/);
  expect(localStorage.getItem(MARCA_CACHE_WEB)).toContain(identidad.logoUrl);
});
