import { describe, expect, it } from 'vitest';
import { validarUrlApiBuild } from './validar-url-build';

describe('URL de API de build web', () => {
  it('exige URL definida y HTTPS', () => {
    expect(() => validarUrlApiBuild(undefined)).toThrow('obligatoria');
    expect(() => validarUrlApiBuild('http://localhost:3000/api')).toThrow('HTTPS');
    expect(() => validarUrlApiBuild('https://localhost/api')).toThrow('HTTPS');
  });
  it('rechaza rutas, credenciales y parámetros ajenos al contrato', () => {
    expect(() => validarUrlApiBuild('https://user:password@api.example.invalid/api')).toThrow();
    expect(() => validarUrlApiBuild('https://api.example.invalid/api?token=x')).toThrow();
    expect(() => validarUrlApiBuild('https://api.example.invalid/')).toThrow();
  });
  it('acepta origen HTTPS exacto en /api', () => {
    expect(validarUrlApiBuild('https://api.example.invalid/api')).toBe('https://api.example.invalid/api');
  });
});

it.each(['https://localhost./api', 'https://alumno.localhost/api', 'https://127.0.0.2/api', 'https://[::1]/api', 'https://[::ffff:127.0.0.1]/api', 'https://api.example.invalid/api?', 'https://api.example.invalid/api#'])('rechaza variantes locales o parámetros vacíos: %s', (url) => {
  expect(() => validarUrlApiBuild(url)).toThrow();
});
