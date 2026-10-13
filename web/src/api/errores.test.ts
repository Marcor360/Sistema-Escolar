import { describe, expect, it } from 'vitest';
import { mensajeDeError } from './errores';

describe('mensajeDeError web', () => {
  it('une errores de validación', () => {
    expect(mensajeDeError({ response: { data: { message: ['Correo inválido', 'Campo requerido'] } } })).toBe(
      'Correo inválido, Campo requerido',
    );
  });

  it('usa el mensaje de la API o un fallback', () => {
    expect(mensajeDeError({ response: { data: { message: 'No autorizado' } } })).toBe('No autorizado');
    expect(mensajeDeError(new Error('fallo'))).toBe('Ocurrió un error inesperado');
  });
});
it('distingue red y timeout', () => {
  expect(mensajeDeError({ code: 'ERR_NETWORK' })).toContain('Revisa tu conexión');
  expect(mensajeDeError({ code: 'ECONNABORTED' })).toContain('tardó demasiado');
});
it('oculta detalles internos y tolera null', () => {
  expect(mensajeDeError({ response: { status: 500, data: { message: 'SQL passwordHash stack' } } })).not.toContain(
    'passwordHash',
  );
  expect(mensajeDeError(null)).toBe('Ocurrió un error inesperado');
});
