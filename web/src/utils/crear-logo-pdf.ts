export const MAX_LOGO_PDF_BYTES = 3 * 1024 * 1024;

export async function crearLogoPdfPng(archivo: File): Promise<File> {
  if (archivo.size <= 0 || archivo.size > 20 * 1024 * 1024) {
    throw new Error('El logo original no puede superar los 20 MB.');
  }
  const url = URL.createObjectURL(archivo);
  try {
    const imagen = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('No se pudo decodificar el logotipo original.'));
      img.src = url;
    });
    if (!imagen.naturalWidth || !imagen.naturalHeight || imagen.naturalWidth * imagen.naturalHeight > 50_000_000) {
      throw new Error('Las dimensiones del logo superan el límite permitido.');
    }
    const canvas = document.createElement('canvas');
    const dimensionMaxima = 768;
    const escala = Math.min(1, dimensionMaxima / Math.max(imagen.naturalWidth, imagen.naturalHeight));
    canvas.width = Math.max(1, Math.round(imagen.naturalWidth * escala));
    canvas.height = Math.max(1, Math.round(imagen.naturalHeight * escala));
    const contexto = canvas.getContext('2d');
    if (!contexto) throw new Error('Tu navegador no permite procesar el logo para PDF.');
    contexto.drawImage(imagen, 0, 0, canvas.width, canvas.height);
    const png = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(resultado => resultado?.type === 'image/png'
        ? resolve(resultado)
        : reject(new Error('No se pudo convertir el logotipo a PNG.')), 'image/png');
    });
    if (png.size < 1 || png.size > MAX_LOGO_PDF_BYTES) {
      throw new Error('El PNG del logo supera los 3 MB; utiliza una imagen con menos detalle.');
    }
    return new File([png], 'logo-pdf.png', { type: 'image/png' });
  } finally {
    URL.revokeObjectURL(url);
  }
}
