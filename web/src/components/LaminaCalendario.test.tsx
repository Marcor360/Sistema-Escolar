import { render, screen, cleanup } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { LaminaCalendario, EventoLamina, MarcadorCalendario } from './LaminaCalendario';
vi.mock('../marca/MarcaContext', async (original) => ({
  ...(await original<typeof import('../marca/MarcaContext')>()),
  useMarca: () => ({ marca: { nombreInstitucion: 'Universidad IUA', logoUrl: '/uploads/marca-logo-prueba.png' } }),
}));
afterEach(cleanup);
const apertura: MarcadorCalendario = {
  clave: 'apertura',
  nombre: 'Apertura',
  color: '#00ff00',
  forma: 'FONDO',
  revision: 0,
};
const inicio: MarcadorCalendario = {
  clave: 'inicio',
  nombre: 'Inicio ejecutivo',
  color: '#125533',
  forma: 'INICIO',
  revision: 0,
};
const ciclo = { nombre: '2027-1', fechaInicio: '2026-09-01', fechaFin: '2026-12-31' };
it('incluye identidad, leyenda, rangos en hora mexicana y todos los eventos superpuestos', () => {
  const eventos: EventoLamina[] = [
    {
      id: 1,
      titulo: 'Pago de septiembre',
      fechaInicio: '2026-09-01T06:00:00Z',
      fechaFin: '2026-09-04T05:59:59Z',
      imagenNombre: null,
      marcador: apertura,
    },
    {
      id: 2,
      titulo: 'Comienzo de clases',
      fechaInicio: '2026-09-02T06:00:00Z',
      fechaFin: null,
      imagenNombre: null,
      marcador: inicio,
    },
  ];
  const { container } = render(
    <LaminaCalendario
      meses={['2026-09']}
      eventos={eventos}
      marcadores={[apertura, inicio]}
      ciclo={ciclo}
      gestionar={false}
      seleccionar={vi.fn()}
    />,
  );
  expect(screen.getByAltText('Logo de Universidad IUA').getAttribute('src')).toContain(
    '/uploads/marca-logo-prueba.png',
  );
  expect(screen.getByText('Universidad IUA')).toBeTruthy();
  expect(screen.getByText('Calendario escolar 2027-1')).toBeTruthy();
  expect(screen.getByLabelText('Leyenda de marcadores').textContent).toContain('Inicio ejecutivo');
  const dos = screen.getByRole('button', { name: 'Seleccionar 2026-09-02: Pago de septiembre; Comienzo de clases' });
  expect(dos.closest('.calendario-celda')?.querySelectorAll('li')).toHaveLength(2);
  expect(
    screen.getByRole('button', { name: 'Seleccionar 2026-09-04' }).closest('.calendario-celda')?.textContent,
  ).not.toContain('Pago de septiembre');
  expect(container.querySelectorAll('.calendario-dias > *')).toHaveLength(42);
  expect((dos as HTMLButtonElement).disabled).toBe(true);
});
it('calcula el 29 de febrero bisiesto y bloquea días fuera del ciclo sin inventar fechas', () => {
  render(
    <LaminaCalendario
      meses={['2028-02']}
      eventos={[]}
      marcadores={[]}
      ciclo={{ nombre: '2028', fechaInicio: '2028-02-05', fechaFin: '2028-02-29' }}
      gestionar
      seleccionar={vi.fn()}
    />,
  );
  expect((screen.getByRole('button', { name: 'Seleccionar 2028-02-29' }) as HTMLButtonElement).disabled).toBe(false);
  expect((screen.getByRole('button', { name: 'Seleccionar 2028-02-01' }) as HTMLButtonElement).disabled).toBe(true);
  expect(screen.queryByRole('button', { name: 'Seleccionar 2028-02-30' })).toBeNull();
});
it('mantiene un indicador visible y leyenda para fechas anteriores o importadas sin marcador', () => {
  render(
    <LaminaCalendario
      meses={['2026-09']}
      eventos={[
        { id: 8, titulo: 'Fecha histórica', fechaInicio: '2026-09-03T06:00:00Z', fechaFin: null, imagenNombre: null },
      ]}
      marcadores={[]}
      ciclo={ciclo}
      gestionar={false}
      seleccionar={vi.fn()}
    />,
  );
  const dia = screen
    .getByRole('button', { name: 'Seleccionar 2026-09-03: Fecha histórica' })
    .closest('.calendario-celda');
  expect(dia?.querySelector('.calendario-simbolo')).toBeTruthy();
  expect(screen.getByLabelText('Leyenda de marcadores').textContent).toContain('Evento sin marcador');
});
