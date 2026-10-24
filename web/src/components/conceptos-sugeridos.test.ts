import { describe, expect, it } from 'vitest';
import { conceptosSugeridos, sugerenciasPorNivel } from './conceptos-sugeridos';

describe('sugerencias de conceptos', () => {
  it('las claves son únicas y cumplen el límite de la API', () => {
    expect(new Set(conceptosSugeridos.map(c => c.clave)).size).toBe(conceptosSugeridos.length);
    expect(conceptosSugeridos.every(c => c.clave.length <= 20 && c.nombre.length <= 120)).toBe(true);
  });
  it('filtra por nivel sin ofrecer titulación a secundaria', () => {
    expect(sugerenciasPorNivel('SECUNDARIA').some(c => c.clave === 'TITULACION')).toBe(false);
    expect(sugerenciasPorNivel('SUPERIOR').some(c => c.clave === 'TITULACION')).toBe(true);
    expect(sugerenciasPorNivel('BACHILLERATO').some(c => c.clave === 'CONST_EST')).toBe(true);
  });
});
