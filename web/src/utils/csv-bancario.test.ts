import { expect, it } from 'vitest';
import { leerCsvBancario } from './csv-bancario';
it('conserva folios textuales y referencias entrecomilladas', () => {
  expect(leerCsvBancario('folio,referencia,fecha,monto\n001,"Referencia, banco",2026-10-26,12.50')).toEqual([
    { folio: '001', referencia: 'Referencia, banco', fecha: '2026-10-26', monto: 12.5 },
  ]);
});
it('no interpreta montos ambiguos y limita archivos vacíos', () => {
  expect(() => leerCsvBancario('folio,referencia,fecha,monto\nA,B,2026-10-26,"1,000"')).toThrow();
  expect(() => leerCsvBancario('folio,referencia,fecha,monto')).toThrow();
});
