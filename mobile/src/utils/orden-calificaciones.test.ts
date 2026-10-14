import { describe, expect, it } from 'vitest';
import { ordenarPeriodos } from './orden-calificaciones';
describe('ordenarPeriodos', () => {
  it('presenta P1-P3 antes de Final y conserva la fuente', () => {
    const fuente = Object.freeze([{ parcial: 0, calificacion: 90 }, { parcial: 3, calificacion: 85 }, { parcial: 1, calificacion: 70 }, { parcial: 2, calificacion: 80 }]);
    expect(ordenarPeriodos(fuente).map((x) => x.parcial)).toEqual([1, 2, 3, 0]);
    expect(fuente.map((x) => x.parcial)).toEqual([0, 3, 1, 2]);
  });
  it('admite periodos pendientes', () => {
    expect(ordenarPeriodos([{ parcial: 0 }, { parcial: 2 }]).map((x) => x.parcial)).toEqual([2, 0]);
  });
});
