/** Mensajes accionables sin exponer respuestas internas del servidor. */
export function mensajeDeError(error: unknown): string {
  const fallo = error as {
    code?: string;
    response?: { status?: number; data?: { message?: string | string[] } };
  } | null;
  if (!fallo?.response && fallo?.code === 'ECONNABORTED')
    return 'La solicitud tardó demasiado. Revisa tu conexión e inténtalo de nuevo.';
  if (!fallo?.response && fallo?.code === 'ERR_NETWORK')
    return 'No se pudo conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.';
  if (fallo?.response?.status === 503)
    return 'El servicio está temporalmente fuera de línea. Inténtalo de nuevo más tarde.';
  if ((fallo?.response?.status ?? 0) >= 500)
    return 'El servidor no pudo completar la solicitud. Inténtalo de nuevo; si persiste, contacta a control escolar.';
  const mensaje = fallo?.response?.data?.message;
  if (Array.isArray(mensaje))
    return mensaje.filter((m) => typeof m === 'string').join(', ') || 'Ocurrió un error inesperado';
  return typeof mensaje === 'string' && mensaje ? mensaje : 'Ocurrió un error inesperado';
}
