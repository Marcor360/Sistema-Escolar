import { describe, expect, it } from 'vitest';
import { resolverApiUrl } from './config';

describe('URL de API móvil', () => {
  it('permite localhost solo en desarrollo', () => {
    expect(resolverApiUrl('development')).toBe('http://localhost:3000/api');
    expect(() => resolverApiUrl('production', 'http://localhost:3000/api')).toThrow('HTTPS');
  });

  it('exige una URL HTTPS en preview y producción', () => {
    expect(() => resolverApiUrl('preview')).toThrow('Falta');
    expect(() => resolverApiUrl('production', 'http://escuela.example/api')).toThrow('HTTPS');
    expect(resolverApiUrl('production', 'https://api.escuela.example/api'))
      .toBe('https://api.escuela.example/api');
  });
});
