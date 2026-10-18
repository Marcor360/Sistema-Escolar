import { planificarGruposRegulares } from './distribucion-grupos';

describe('planificarGruposRegulares', () => {
  it.each<[number, number[], number]>([
    [0, [], 0],
    [1, [], 1],
    [2, [], 2],
    [3, [], 3],
    [4, [], 4],
    [5, [5], 0],
    [49, [49], 0],
    [50, [50], 0],
    [51, [51], 0],
    [52, [52], 0],
    [53, [53], 0],
    [54, [54], 0],
    [55, [50, 5], 0],
    [99, [50, 49], 0],
    [100, [50, 50], 0],
    [101, [50, 51], 0],
    [102, [50, 52], 0],
    [103, [50, 53], 0],
    [104, [50, 54], 0],
    [105, [50, 50, 5], 0],
    [150, [50, 50, 50], 0],
  ])('reparte %i alumnos en %j con %i pendientes', (cantidad, grupos, pendientes) => {
    expect(planificarGruposRegulares(cantidad)).toEqual({ grupos, pendientes });
  });

  it('conserva el total y los límites para todas las cohortes entre cero y diez mil', () => {
    for (let cantidad = 0; cantidad <= 10_000; cantidad++) {
      const { grupos, pendientes } = planificarGruposRegulares(cantidad);
      expect(grupos.reduce((suma, cupo) => suma + cupo, pendientes)).toBe(cantidad);
      expect(pendientes).toBe(cantidad < 5 ? cantidad : 0);
      expect(grupos.every((cupo) => cupo >= 5 && cupo <= 54)).toBe(true);
      expect(grupos.slice(0, -1).every((cupo) => cupo === 50)).toBe(true);
    }
  });

  it('cada ejecución produce un plan independiente, incluso en la transición 54 a 55', () => {
    const anterior = planificarGruposRegulares(54);
    expect(planificarGruposRegulares(55).grupos).toEqual([50, 5]);
    expect(anterior.grupos).toEqual([54]);
    anterior.grupos[0] = 0;
    expect(planificarGruposRegulares(54).grupos).toEqual([54]);
  });

  it.each([-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1])(
    'rechaza cantidades inválidas: %s',
    (cantidad) => {
      expect(() => planificarGruposRegulares(cantidad)).toThrow(RangeError);
    },
  );
});
