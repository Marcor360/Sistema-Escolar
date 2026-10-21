export const MAX_LOGO_ORIGINAL_BYTES = 20 * 1024 * 1024;
export const MAX_LOGO_WEBP_BYTES = 10 * 1024 * 1024;

function cargarImagen(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const imagen = new Image();
    imagen.onload = () => resolve(imagen);
    imagen.onerror = () => reject(new Error('No se puede abrir la imagen. Selecciona un PNG, JPG o WebP válido.'));
    imagen.src = url;
  });
}

function generarWebp(canvas: HTMLCanvasElement, calidad: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((resultado) => {
      if (!resultado || resultado.type !== 'image/webp') {
        reject(new Error('El navegador no pudo convertir el logo a WebP. Utiliza una versión actualizada.'));
        return;
      }
      resolve(resultado);
    }, 'image/webp', calidad);
  });
}

/** La optimización corresponde solo al logo; el resto de adjuntos conserva su contrato. */
export async function optimizarLogo(archivo: File): Promise<File> {
  if (!archivo.size || archivo.size > MAX_LOGO_ORIGINAL_BYTES) {
    throw new Error('El logotipo original debe pesar como máximo 20 MB.');
  }
  if (!/\.(png|jpe?g|webp)$/i.test(archivo.name)) {
    throw new Error('Selecciona una imagen PNG, JPG o WebP válida.');
  }

  const url = URL.createObjectURL(archivo);
  try {
    const imagen = await cargarImagen(url);
    const ancho = imagen.naturalWidth;
    const alto = imagen.naturalHeight;
    if (!ancho || !alto || ancho * alto > 50_000_000) {
      throw new Error('La imagen supera el límite de resolución permitido (50 megapíxeles).');
    }
    const canvas = document.createElement('canvas');
    const contexto = canvas.getContext('2d');
    if (!contexto) throw new Error('No se puede procesar la imagen en este navegador.');

    for (const lado of [2048, 1536, 1024]) {
      const escala = Math.min(1, lado / Math.max(ancho, alto));
      canvas.width = Math.max(1, Math.round(ancho * escala));
      canvas.height = Math.max(1, Math.round(alto * escala));
      contexto.clearRect(0, 0, canvas.width, canvas.height);
      contexto.drawImage(imagen, 0, 0, canvas.width, canvas.height);
      for (const calidad of [0.85, 0.7, 0.55, 0.4]) {
        const webp = await generarWebp(canvas, calidad);
        if (webp.size > 0 && webp.size <= MAX_LOGO_WEBP_BYTES) {
          return new File([webp], 'logo-institucional.webp', { type: 'image/webp' });
        }
      }
    }
    throw new Error('No se pudo reducir el logo a 10 MB. Selecciona una imagen de menor resolución.');
  } finally {
    URL.revokeObjectURL(url);
  }
}
