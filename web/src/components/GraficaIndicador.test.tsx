import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { GraficaIndicador } from './GraficaIndicador';
afterEach(cleanup);
it('separa presentación, valores exactos y categorías sin convertir ingresos en utilidad', () => {
  render(
    <GraficaIndicador
      titulo="Ingresos por carrera"
      detalle="Pagos aplicados"
      datos={[
        { id: '1', etiqueta: 'Derecho · Centro', valor: 125 },
        { id: '2', etiqueta: 'Sin carrera identificada', valor: 0 },
      ]}
      moneda
    />,
  );
  expect(screen.getByRole('img').getAttribute('aria-label')).toContain('125');
  fireEvent.click(screen.getByRole('button', { name: 'Líneas' }));
  expect(screen.getByText(/no representan una tendencia temporal/)).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: /Derecho · Centro/ }));
  expect(screen.getByRole('status').textContent).toContain('Derecho');
  expect(screen.getByRole('table', { hidden: true })).toBeTruthy();
});
it('distingue la ausencia de registros del cero registrado', () => {
  const { rerender } = render(<GraficaIndicador titulo="Alumnos" detalle="Inscritos" datos={[]} />);
  expect(screen.getByText(/Sin registros/)).toBeTruthy();
  rerender(
    <GraficaIndicador titulo="Alumnos" detalle="Inscritos" datos={[{ id: '0', etiqueta: 'Sin carrera', valor: 0 }]} />,
  );
  expect(screen.getByRole('img')).toBeTruthy();
  expect(screen.queryByText(/Sin registros/)).toBeNull();
});
