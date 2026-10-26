import { completarMeses } from './comparativas.service';
it('rellena meses sin filas con cero sin duplicar los meses existentes', () => {
  expect(
    completarMeses([{ id: '2026-02', etiqueta: '2026-02', valor: 20 }], '2026-01-15', '2026-03-31').map((p) => p.valor),
  ).toEqual([0, 20, 0]);
});
