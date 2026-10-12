import { describe, expect, it } from 'vitest';
import { textoSobreFondo } from './theme';

const contraste = (fondo: string, texto: string) => {
  const l = (c: string) => {
    const valores = [1, 3, 5].map((p) => {
      const x = Number.parseInt(c.slice(p, p + 2), 16) / 255;
      return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * valores[0] + 0.7152 * valores[1] + 0.0722 * valores[2];
  };
  const a = l(fondo), b = l(texto);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
};

describe('Contraste del tema móvil', () => {
  it('supera WCAG AA para una muestra de marcas claras, oscuras e intermedias', () => {
    for (const fondo of ['#14343B', '#FFFFFF', '#887C6B', '#C79A3C', '#3246B5', '#5C6A66']) {
      expect(contraste(fondo, textoSobreFondo(fondo))).toBeGreaterThanOrEqual(4.5);
    }
  });
});
