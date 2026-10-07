import { promedioOficial } from './promedio-oficial';

describe('Promedio oficial compartido por API y reportes', () => {
  it('exige los tres parciales y conserva el cero como nota válida', () => {
    expect(promedioOficial(new Map([[1, 80], [2, 90]]))).toBeNull();
    expect(promedioOficial(new Map([[1, 0], [2, 90], [3, 90]]))).toBe(60);
  });
  it('excluye final y redondea a un decimal', () => {
    expect(promedioOficial(new Map([[1, 60], [2, 90], [3, 90], [0, 100]]))).toBe(80);
    expect(promedioOficial(new Map([[1, 83.3], [2, 84.4], [3, 89.9]]))).toBe(85.9);
  });
});
