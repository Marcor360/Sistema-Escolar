import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { api } from '../api/client';
import AnaliticaPage from './Analitica';

const base = { ciclo: { nombre: 'Ciclo 2026' }, modo: 'HISTORICO', generadoEn: '2026-10-12T12:00:00Z' };
const academico = { regla: 'Solo clases dentro de tu alcance', clases: [{
  grupoMateriaId: 1, plantel: 'Centro', grupo: 'Primero', materia: 'Matemáticas',
  inscritos: 2, participantesHistoricos: 2, inscritosVigentes: 0, oficialesCompletos: 0,
  promedioOficial: null, aprobados: 0, bajoReferencia: 0,
  entregasRecibidas: 0, entregasEsperadas: 3, entregasFaltantes: 3,
  parciales: [{ parcial: 1, capturados: 0, faltantes: 2, promedio: null }],
}] };
const financiero = { cargos: 0, facturado: 0, aplicado: 0, saldo: 0 };

function preparar(resultado: object) {
  return vi.spyOn(api, 'get').mockImplementation(async (ruta) => ({ data:
    ruta === '/analitica' ? resultado : ruta === '/academico/ciclos'
      ? [{ id: 2, clave: '2026' }] : [{ id: 3, nombre: 'Centro' }],
  }));
}
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it('explica el estado inicial y envía únicamente los filtros elegidos', async () => {
  const obtener = preparar({ ...base, academico: { ...academico, clases: [] } });
  render(<AnaliticaPage />);
  expect(screen.getByText('Consulta los indicadores de tu institución')).toBeTruthy();
  await screen.findByRole('option', { name: '2026' });
  expect(obtener.mock.calls.some(([ruta]) => ruta === '/analitica')).toBe(false);
  fireEvent.change(screen.getByLabelText('Ciclo'), { target: { value: '2' } });
  fireEvent.change(screen.getByLabelText('Plantel'), { target: { value: '3' } });
  fireEvent.click(screen.getByRole('button', { name: 'Consultar indicadores' }));
  await screen.findByText('Sin clases dentro del alcance seleccionado.');
  expect(obtener).toHaveBeenCalledWith('/analitica', { params: { cicloId: '2', plantelId: '3' } });
});

it('muestra una respuesta académica de maestro sin indicadores financieros', async () => {
  preparar({ ...base, academico }); render(<AnaliticaPage />);
  fireEvent.click(screen.getByRole('button', { name: 'Consultar indicadores' }));
  await screen.findByRole('region', { name: 'Seguimiento por clase' });
  expect(screen.queryByText('Finanzas del ciclo')).toBeNull();
  expect(screen.getByText('Pendiente')).toBeTruthy();
  expect(screen.getByText('0 de 3; faltan 3')).toBeTruthy();
  expect(screen.getByRole('region', { name: 'Seguimiento por clase' }).tabIndex).toBe(0);
});

it('agrupa cada indicador financiero con su valor sin inventar una sección académica', async () => {
  preparar({ ...base, financiero }); render(<AnaliticaPage />);
  fireEvent.click(screen.getByRole('button', { name: 'Consultar indicadores' }));
  await screen.findByText('Finanzas del ciclo');
  expect(screen.queryByRole('table')).toBeNull();
  const grupo = screen.getByText('Cargos vigentes').parentElement!;
  expect(within(grupo).getByText('0').tagName).toBe('DD');
  expect(grupo.parentElement?.tagName).toBe('DL');
});

it('conserva ambas secciones para una respuesta autorizada de varios roles', async () => {
  preparar({ ...base, academico, financiero }); render(<AnaliticaPage />);
  fireEvent.click(screen.getByRole('button', { name: 'Consultar indicadores' }));
  await screen.findByText('Finanzas del ciclo');
  expect(screen.getByRole('table')).toBeTruthy();
});

it('preserva filtros y permite reintentar después de un error de consulta', async () => {
  const obtener = preparar({ ...base, academico }); render(<AnaliticaPage />);
  await screen.findByRole('option', { name: '2026' });
  fireEvent.change(screen.getByLabelText('Ciclo'), { target: { value: '2' } });
  obtener.mockRejectedValueOnce(new Error('Sin conexión'));
  fireEvent.click(screen.getByRole('button', { name: 'Consultar indicadores' }));
  await screen.findByRole('alert');
  expect((screen.getByLabelText('Ciclo') as HTMLSelectElement).value).toBe('2');
  fireEvent.click(screen.getByRole('button', { name: 'Consultar indicadores' }));
  await screen.findByRole('table');
  await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
});
