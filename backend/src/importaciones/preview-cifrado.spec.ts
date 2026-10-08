import { PreviewCifrado } from './preview-cifrado';
it('cifra sin PII legible, autentica actor/posición y rechaza manipulación o rotación de clave', () => {
  const servicio = new PreviewCifrado('clave-private'), fila = { nombre: 'Dato reservado', email: 'privado@example.invalid' }, contexto = 'preview:1:ALUMNOS:0';
  const cifrado = servicio.cifrar(fila, contexto); expect(cifrado).not.toContain(fila.nombre); expect(cifrado).not.toContain(fila.email);
  expect(servicio.descifrar(cifrado, contexto)).toEqual(fila);
  expect(() => servicio.descifrar(cifrado, 'preview:2:ALUMNOS:0')).toThrow();
  expect(() => servicio.descifrar(cifrado, 'preview:1:ALUMNOS:1')).toThrow();
  expect(() => new PreviewCifrado('otra-clave').descifrar(cifrado, contexto)).toThrow();
  const alterado = Buffer.from(cifrado,'base64'); alterado[alterado.length-1] ^= 1;
  expect(() => servicio.descifrar(alterado.toString('base64'), contexto)).toThrow();
});
