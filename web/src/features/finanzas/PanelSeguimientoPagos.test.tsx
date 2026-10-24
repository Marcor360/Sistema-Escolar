import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { api } from '../../api/client';
import { PanelSeguimientoPagos } from './PanelSeguimientoPagos';

vi.mock('../../components/SeguimientoCobranza', () => ({ SeguimientoCobranza: () => null }));
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
const respuesta = (matricula: string) => ({
  datos: [{ alumnoId: 1, matricula, nombre: 'Alumno', telefono: '5551234567', email: null,
    saldo: 100, abonado: 0, numeroCargos: 1, primerVencimiento: null, vencidos: 0 }],
  total: 1, pagina: 1, porPagina: 10, nota: '',
  resumen: { alumnosConSaldo: 1, sinAbono: 1, conAbonoParcial: 0, vencidos: 0 },
});
it('descarta contactos tardíos del plantel anterior y limpia el listado al quitar la selección', async () => {
  let resolver!: (r: { data: ReturnType<typeof respuesta> }) => void;
  const anterior = new Promise<{ data: ReturnType<typeof respuesta> }>((r) => { resolver = r; });
  vi.spyOn(api, 'get').mockImplementation(async (ruta, config) => {
    if (ruta === '/planteles/mios') return { data: [{ id: 1, nombre: 'Uno' }, { id: 2, nombre: 'Dos' }] };
    const plantel = (config?.params as { plantelId?: number }).plantelId;
    return plantel === 1 ? anterior : { data: respuesta('ALUMNO-DOS') };
  });
  render(<PanelSeguimientoPagos />);
  await screen.findByRole('option', { name: 'Uno' });
  const selector = screen.getByLabelText('Plantel');
  fireEvent.change(selector, { target: { value: '1' } });
  fireEvent.change(selector, { target: { value: '2' } });
  await screen.findByText('ALUMNO-DOS');
  await act(async () => resolver({ data: respuesta('ALUMNO-UNO') }));
  expect(screen.queryByText('ALUMNO-UNO')).toBeNull();
  expect(screen.getByRole('link', { name: 'Llamar al contacto registrado de ALUMNO-DOS' })).toBeTruthy();
  fireEvent.change(selector, { target: { value: '' } });
  expect(screen.queryByText('ALUMNO-DOS')).toBeNull();
  expect(screen.queryByRole('link', { name: /Llamar al contacto/ })).toBeNull();
});
