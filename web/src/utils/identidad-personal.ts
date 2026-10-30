/** Valida sin perder los valores que el usuario ya capturó. La API repite la validación. */
export function validarIdentidadPersonal(datos: {
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
}): string | null {
  if (!datos.nombre.trim()) return 'Escribe el nombre.';
  if (!datos.apellidoPaterno.trim()) return 'Escribe el primer apellido.';
  if (!datos.apellidoMaterno.trim()) return 'Escribe el segundo apellido.';
  return null;
}
