const EXTENSIONES = new Set([
  "pdf",
  "doc",
  "docx",
  "ppt",
  "pptx",
  "xls",
  "xlsx",
  "png",
  "jpg",
  "jpeg",
  "webp",
  "gif",
  "bmp",
  "zip",
  "txt",
  "odt",
  "ods",
  "odp",
  "rtf",
  "csv",
  "md",
  "mp3",
  "wav",
  "mp4",
  "m4a",
]);
/** Comprobación previa; el servidor mantiene los límites y valida de nuevo. */
export function validarArchivoEntrega(archivo: {
  name: string;
  size?: number;
  uri?: string;
}): string | null {
  if (archivo.uri !== undefined) {
    try {
      if (
        !/^(file|content):\/\//i.test(archivo.uri) ||
        /[\\\u0000-\u001F\u007F]/.test(archivo.uri) ||
        /%(?:0[0-9a-f]|1[0-9a-f]|7f)/i.test(archivo.uri) ||
        archivo.uri.trim() !== archivo.uri
      )
        throw new Error("URI inválida");
      const uri = new URL(archivo.uri);
      if (
        uri.username ||
        uri.password ||
        uri.hash ||
        uri.pathname.length <= 1 ||
        (uri.protocol === "file:"
          ? !!uri.hostname
          : uri.protocol !== "content:" || !uri.hostname)
      )
        throw new Error("URI inválida");
    } catch {
      return "Selecciona un archivo local del dispositivo.";
    }
  }
  if (/[\\/\u0000-\u001F\u007F]/.test(archivo.name))
    return "El nombre del archivo contiene caracteres no permitidos.";
  if (!archivo.name || archivo.name.length > 200)
    return "El archivo debe tener un nombre de máximo 200 caracteres.";
  const extension = archivo.name.split(".").pop()?.toLowerCase();
  if (!extension || !EXTENSIONES.has(extension))
    return "Formato no permitido. Usa PDF, Office, OpenDocument, imagen, RTF, CSV, TXT, MD, ZIP, MP3, WAV, MP4 o M4A.";
  if (
    archivo.size !== undefined &&
    (!Number.isFinite(archivo.size) || archivo.size <= 0)
  )
    return "El archivo está vacío o su tamaño no es válido.";
  if (archivo.size !== undefined && archivo.size > 100 * 1024 * 1024)
    return "El archivo supera el límite de 100 MB.";
  return null;
}
