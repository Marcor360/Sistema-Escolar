import { planificarGruposRegulares } from './distribucion-grupos';

describe('planificarGruposRegulares', () => {
  it.each<[number, number[], number]>([
    [0, [], 0],
    [1, [], 1],
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
    [103, [50, 53], 0],
    [104, [50, 54], 0],
    [105, [50, 50, 5], 0],
    [150, [50, 50, 50], 0],
  ])('reparte %i alumnos en %j con %i pendientes', (cantidad, grupos, pendientes) => {
    expect(planificarGruposRegulares(cantidad)).toEqual({ grupos, pendientes });
  });

  it.each([-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1])(
    'rechaza cantidades inválidas: %s',
    (cantidad) => {
      expect(() => planificarGruposRegulares(cantidad)).toThrow(RangeError);
    },
  );
});
