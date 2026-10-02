import { describe, expect, it } from 'vitest';
import { mensajeDeError } from './errores';

describe('mensajeDeError web', () => {
  it('une errores de validación', () => {
    expect(mensajeDeError({ response: { data: { message: ['Correo inválido', 'Campo requerido'] } } }))
      .toBe('Correo inválido, Campo requerido');
  });

  it('usa el mensaje de la API o un fallback', () => {
    expect(mensajeDeError({ response: { data: { message: 'No autorizado' } } })).toBe('No autorizado');
    expect(mensajeDeError(new Error('fallo'))).toBe('Ocurrió un error inesperado');
  });
});
