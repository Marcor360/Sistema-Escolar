import { describe, expect, it } from 'vitest';
import { contrasteAA, esMarcaWebValida, textoAccesible } from './MarcaContext';

const fondos = ['#14343B', '#0E262B', '#C79A3C', '#FFFFFF', '#000000', '#4371B4', '#CDEBE8', '#887C6B'];

describe('Identidad institucional accesible', () => {
  it('selecciona texto que cumple 4.5:1 para colores configurables', () => {
    for (const fondo of fondos) {
      const texto = textoAccesible(fondo);
      expect(contrasteAA(fondo, texto)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('el color oscuro predeterminado usa texto blanco', () => {
    expect(textoAccesible('#14343B')).toBe('#ffffff');
  });

  it('el acento dorado predeterminado usa texto oscuro', () => {
    expect(textoAccesible('#C79A3C')).toBe('#19272c');
  });
});

it('valida caché pública sin aceptar archivos privados ni colores malformados', () => {
  const base = {
    nombreInstitucion: 'IUA', nombreCorto: 'IUA', logoUrl: '/uploads/marca-logo-123abc.webp',
    colorPrimario: '#AABBCC', colorPrimarioOscuro: '#223344', colorAcento: '#DDEEFF',
    actualizadoEn: '2026-10-21T12:00:00Z',
  };
  expect(esMarcaWebValida(base)).toBe(true);
  expect(esMarcaWebValida({ ...base, logoUrl: '/uploads/expediente-privado.pdf' })).toBe(false);
  expect(esMarcaWebValida({ ...base, colorAcento: 'rojo' })).toBe(false);
  expect(esMarcaWebValida(null)).toBe(false);
});
