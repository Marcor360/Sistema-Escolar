/** Convierte errores de respuesta del backend en mensajes visibles para el usuario. */
export function mensajeDeError(error: unknown): string {
  const data = (error as { response?: { data?: { message?: string | string[] } } }).response?.data;
  if (Array.isArray(data?.message)) return data.message.join(', ');
  return data?.message || 'Ocurrió un error inesperado';
}
