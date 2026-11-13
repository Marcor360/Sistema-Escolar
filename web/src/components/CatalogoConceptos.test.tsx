import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { api } from '../api/client';
import { CatalogoConceptos } from './CatalogoConceptos';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

it('distingue catálogo vacío de fallo de red y permite reintentar', async () => {
  const obtener = vi.spyOn(api, 'get')
    .mockRejectedValueOnce(new Error('Sin conexión'))
    .mockResolvedValue({ data: [] });
  render(<CatalogoConceptos cambiado={() => undefined} />);
  expect(await screen.findByRole('alert')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Reintentar consulta' }));
  expect(await screen.findByText(/Todavía no hay conceptos/)).toBeTruthy();
  expect(obtener).toHaveBeenCalledTimes(2);
});

it('aclara que crear conceptos no genera cargos y que la tarifa base no es retroactiva', async () => {
  vi.spyOn(api, 'get').mockResolvedValue({ data: [] });
  render(<CatalogoConceptos cambiado={() => undefined} />);
  expect(await screen.findByText(/Todavía no hay conceptos/)).toBeTruthy();
  expect(screen.getByText(/Editar la tarifa base no modifica automáticamente/)).toBeTruthy();
});
