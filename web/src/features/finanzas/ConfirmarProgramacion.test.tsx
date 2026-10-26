import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { api } from '../../api/client';
import { ConfirmarProgramacion } from './ConfirmarProgramacion';
vi.mock('../../components/ContextoAcademicoSelector', () => ({ CONTEXTO_VACIO: {}, ContextoAcademicoSelector: () => null }));
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
const cotizacion = { modalidad: 'SUPERIOR' as const, total: 400, mesInicio: '2027-01', diaVencimiento: 5 };
const plan = { id: 12, alumnoId: 8, plantelId: 2, cicloId: 3, conceptoId: 4, modalidad: 'SUPERIOR', total: 400,
  cuotas: [{ numero: 1, periodo: '2027-01', fechaVencimiento: '2027-01-05', monto: 100, etiqueta: 'Cuota 1', cargoId: null }] };
it('recupera un plan guardado después de recargar y emite sobre ese mismo plan', async () => {
  let emitido = false;
  vi.spyOn(api, 'get').mockImplementation(async ruta => ({ data: String(ruta).includes('/programaciones/')
    ? { ...plan, cuotas: plan.cuotas.map(c => ({ ...c, cargoId: emitido ? 9 : null })) } : [] }));
  const post = vi.spyOn(api, 'post').mockImplementation(async () => { emitido = true; return { data: { cargoId: 9 } }; });
  render(<ConfirmarProgramacion cotizacion={cotizacion}/>);
  fireEvent.change(screen.getByLabelText('Número de programación guardada'), { target: { value: '12' } });
  fireEvent.click(screen.getByRole('button', { name: 'Consultar programación' }));
  await screen.findByText(/Programación #12/);
  fireEvent.click(screen.getByRole('button', { name: 'Emitir cargo' }));
  await screen.findByText('Cargo #9');
  expect(post).toHaveBeenCalledWith('/finanzas/programaciones/12/cuotas/1/emitir', { confirmado: true });
});
it('un rechazo de alcance no deja disponible un plan ajeno para emitir', async () => {
  vi.spyOn(api, 'get').mockImplementation(async ruta => {
    if (String(ruta).includes('/programaciones/')) throw { response: { status: 403, data: { message: 'Plantel no autorizado' } } };
    return { data: [] };
  });
  render(<ConfirmarProgramacion cotizacion={cotizacion}/>);
  fireEvent.change(screen.getByLabelText('Número de programación guardada'), { target: { value: '12' } });
  fireEvent.click(screen.getByRole('button', { name: 'Consultar programación' }));
  await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Plantel no autorizado'));
  expect(screen.queryByRole('button', { name: 'Emitir cargo' })).toBeNull();
});
