import { beforeEach, expect, it, vi } from 'vitest';
import { api } from '../api/client';
import { obtenerResumenInicio } from './inicio-resumen';

vi.mock('../api/client', () => ({ api: { get: vi.fn() } }));

const tareas = [
  { id: 1, entrega: null },
  { id: 2, entrega: { estatus: 'ENTREGADA' } },
];
const avisos = [{ id: 3, titulo: 'Aviso', mensaje: 'Clase', leida: false, createdAt: '2026-10-13T12:00:00Z' }];
const eventos = [{ id: 4, titulo: 'Examen', tipo: 'ACADEMICO', fechaInicio: '2026-10-15T12:00:00Z' }];

beforeEach(() => vi.mocked(api.get).mockReset());

it('combina las cuatro fuentes del mismo alumno cuando todas responden', async () => {
  vi.mocked(api.get)
    .mockResolvedValueOnce({ data: tareas })
    .mockResolvedValueOnce({ data: { saldoTotal: 0 } })
    .mockResolvedValueOnce({ data: avisos })
    .mockResolvedValueOnce({ data: eventos });

  const resumen = await obtenerResumenInicio('2026-10-13T00:00:00Z', '2026-11-12T00:00:00Z');
  expect(resumen).toEqual({ pendientes: 1, saldo: 0, avisos, eventos, errores: [] });
  expect(api.get).toHaveBeenNthCalledWith(1, '/alumnos/me/tareas');
  expect(api.get).toHaveBeenNthCalledWith(2, '/finanzas/me/estado-cuenta');
  expect(api.get).toHaveBeenNthCalledWith(3, '/notificaciones/mias');
  expect(api.get).toHaveBeenNthCalledWith(4, '/calendario', {
    params: { desde: '2026-10-13T00:00:00Z', hasta: '2026-11-12T00:00:00Z' },
  });
});

it('una caída de finanzas no oculta tareas, avisos ni calendario', async () => {
  vi.mocked(api.get)
    .mockResolvedValueOnce({ data: tareas })
    .mockRejectedValueOnce(new Error('Finanzas sin respuesta'))
    .mockResolvedValueOnce({ data: avisos })
    .mockResolvedValueOnce({ data: eventos });

  expect(await obtenerResumenInicio('inicio', 'fin')).toEqual({
    pendientes: 1,
    saldo: null,
    avisos,
    eventos,
    errores: ['estado de cuenta'],
  });
});

it('distingue un valor vacío válido de un fallo de conexión', async () => {
  vi.mocked(api.get)
    .mockResolvedValueOnce({ data: [] })
    .mockResolvedValueOnce({ data: { saldoTotal: 0 } })
    .mockRejectedValueOnce(new Error('Sin avisos'))
    .mockResolvedValueOnce({ data: [] });

  expect(await obtenerResumenInicio('inicio', 'fin')).toEqual({
    pendientes: 0,
    saldo: 0,
    avisos: null,
    eventos: [],
    errores: ['avisos'],
  });
});

it('si ninguna fuente responde no muestra ceros ni estados vacíos falsos', async () => {
  vi.mocked(api.get).mockRejectedValue(new Error('Sin conexión'));

  expect(await obtenerResumenInicio('inicio', 'fin')).toEqual({
    pendientes: null,
    saldo: null,
    avisos: null,
    eventos: null,
    errores: ['tareas', 'estado de cuenta', 'avisos', 'calendario'],
  });
});
