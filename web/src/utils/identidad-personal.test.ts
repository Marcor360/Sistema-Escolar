import { expect, it } from 'vitest';
import { validarIdentidadPersonal } from './identidad-personal';

it('requiere nombre y ambos apellidos, sin obligar segundo nombre', () => {
  expect(validarIdentidadPersonal({ nombre: 'Ana', apellidoPaterno: 'Pérez', apellidoMaterno: 'López' })).toBeNull();
  expect(validarIdentidadPersonal({ nombre: '   ', apellidoPaterno: 'Pérez', apellidoMaterno: 'López' })).toBe('Escribe el nombre.');
  expect(validarIdentidadPersonal({ nombre: 'Ana', apellidoPaterno: ' ', apellidoMaterno: 'López' })).toBe('Escribe el primer apellido.');
  expect(validarIdentidadPersonal({ nombre: 'Ana', apellidoPaterno: 'Pérez', apellidoMaterno: '  ' })).toBe('Escribe el segundo apellido.');
});
