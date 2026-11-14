import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
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

it('corrige un concepto RECARGO histórico sin intentar cambiar su tipo', async () => {
  vi.spyOn(api, 'get').mockResolvedValue({
    data: [{ id: 7, clave: 'RC', nombre: 'Recargo legado', tipo: 'RECARGO', montoBase: 0, activo: true, aplicaRecargo: false }],
  });
  const actualizar = vi.spyOn(api, 'patch').mockResolvedValue({ data: {} });
  render(<CatalogoConceptos cambiado={() => undefined} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Editar concepto' }));
  expect((screen.getByLabelText('Tipo') as HTMLSelectElement).disabled).toBe(true);
  fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Recargo anterior' } });
  fireEvent.submit(screen.getByRole('button', { name: 'Guardar corrección' }).closest('form')!);
  await waitFor(() => expect(actualizar).toHaveBeenCalledWith(
    '/finanzas/conceptos/7',
    expect.not.objectContaining({ tipo: 'RECARGO' }),
  ));
});

it('no reclasifica un concepto de colegiatura aunque cambie su tarifa base', async () => {
  vi.spyOn(api, 'get').mockResolvedValue({
    data: [{ id: 8, clave: 'COL8', nombre: 'Colegiatura vigente', tipo: 'COLEGIATURA', montoBase: 1000, activo: true, aplicaRecargo: false }],
  });
  const patch = vi.spyOn(api, 'patch').mockResolvedValue({ data: {} });
  render(<CatalogoConceptos cambiado={() => undefined} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Editar concepto' }));
  expect((screen.getByLabelText('Tipo') as HTMLSelectElement).disabled).toBe(true);
  fireEvent.change(screen.getByLabelText('Monto base'), { target: { value: '1200' } });
  fireEvent.submit(screen.getByRole('button', { name: 'Guardar corrección' }).closest('form')!);
  await waitFor(() => expect(patch).toHaveBeenCalledWith('/finanzas/conceptos/8',
    expect.objectContaining({ montoBase: 1200 })));
  expect(patch.mock.calls[0][1]).not.toHaveProperty('tipo');
});
