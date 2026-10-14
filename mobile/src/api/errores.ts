type ErrorApi = {
  code?: string;
  response?: { status?: number; data?: { message?: string | string[] } };
};

export function mensajeDeError(error: unknown): string {
  const fallo = (error ?? {}) as ErrorApi;
  if (!fallo.response) {
    return fallo.code === "ECONNABORTED"
      ? "La solicitud tardó demasiado. Revisa tu conexión e inténtalo de nuevo."
      : "No se pudo conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.";
  }
  if (fallo.response.status === 503)
    return "El servicio está temporalmente fuera de línea. Inténtalo de nuevo más tarde.";
  if ((fallo.response.status ?? 0) >= 500)
    return "El servidor no pudo completar la solicitud. Inténtalo de nuevo; si persiste, contacta a control escolar.";
  const message = fallo.response.data?.message;
  if (Array.isArray(message))
    return (
      message.filter((m) => typeof m === "string").join(", ") ||
      "Ocurrió un error inesperado"
    );
  return typeof message === "string" && message
    ? message
    : "Ocurrió un error inesperado";
}
