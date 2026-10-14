const EXTENSIONES = new Set([
  "pdf", "doc", "docx", "ppt", "pptx", "xls", "xlsx",
  "png", "jpg", "jpeg", "zip", "txt",
]);
/** Comprobación previa; el servidor mantiene los límites y valida de nuevo. */
export function validarArchivoEntrega(archivo: { name: string; size?: number }): string | null {
  if (!archivo.name || archivo.name.length > 200)
    return "El archivo debe tener un nombre de máximo 200 caracteres.";
  const extension = archivo.name.split(".").pop()?.toLowerCase();
  if (!extension || !EXTENSIONES.has(extension))
    return "Formato no permitido. Usa PDF, documentos de Office, imagen, ZIP o TXT.";
  if (archivo.size === 0) return "El archivo está vacío.";
  if (archivo.size !== undefined && archivo.size > 5 * 1024 * 1024)
    return "El archivo supera el límite preliminar de 5 MB. El servidor aplicará su límite configurado.";
  return null;
}
