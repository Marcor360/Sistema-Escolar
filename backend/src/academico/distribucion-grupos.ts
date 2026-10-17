export interface PlanGruposRegulares {
  grupos: number[];
  pendientes: number;
}

/**
 * Un remanente de uno a cuatro alumnos se incorpora a un grupo completo
 * para no crear grupos regulares por debajo del mínimo institucional.
 */
export function planificarGruposRegulares(cantidad: number): PlanGruposRegulares {
  if (!Number.isSafeInteger(cantidad) || cantidad < 0) {
    throw new RangeError('La cantidad de alumnos debe ser un entero no negativo');
  }
  if (cantidad < 5) return { grupos: [], pendientes: cantidad };

  const completos = Math.floor(cantidad / 50);
  const remanente = cantidad % 50;
  if (completos === 0) return { grupos: [cantidad], pendientes: 0 };
  if (remanente === 0) return { grupos: Array<number>(completos).fill(50), pendientes: 0 };
  if (remanente < 5) {
    return {
      grupos: [...Array<number>(completos - 1).fill(50), 50 + remanente],
      pendientes: 0,
    };
  }
  return { grupos: [...Array<number>(completos).fill(50), remanente], pendientes: 0 };
}
