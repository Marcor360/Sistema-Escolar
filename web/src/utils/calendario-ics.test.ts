import { expect, it } from 'vitest';
import { generarIcs } from './calendario-ics';
it('exporta texto escapado sin imágenes ni enlaces privados', () => {
  const s = generarIcs([
    { id: 1, titulo: 'Clase, aviso;\nNuevo', fechaInicio: '2026-10-26T12:00:00Z', fechaFin: null, imagenNombre: null },
    {
      id: 2,
      titulo: 'Imagen privada',
      fechaInicio: '2026-10-26T12:00:00Z',
      fechaFin: null,
      imagenNombre: 'privada.png',
    },
  ]);
  expect(s).toContain('SUMMARY:Clase\\, aviso\\;\\nNuevo');
  expect(s).not.toContain('Imagen privada');
  expect(s).toContain('DTSTART:20261026T120000Z');
});
