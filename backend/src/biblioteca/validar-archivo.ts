import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { execFile } from 'child_process';
import { extname } from 'path';
/** Lista cerrada: no SVG, ejecutables ni documentos con macros. Nunca se confía en el MIME del navegador. */
export function validarArchivo(buffer: Buffer, nombre: string, mime: string, categoria: string) {
  if (!buffer.length || buffer.length > 10 * 1024 * 1024)
    throw new BadRequestException('Archivo vacío o mayor que 10 MB');
  const extension = extname(nombre).toLowerCase();
  const png =
    buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) &&
    buffer.subarray(-8).equals(Buffer.from([73, 69, 78, 68, 174, 66, 96, 130]));
  const jpg =
    buffer[0] === 255 &&
    buffer[1] === 216 &&
    buffer[2] === 255 &&
    buffer[buffer.length - 2] === 255 &&
    buffer[buffer.length - 1] === 217;
  const pdf = buffer.subarray(0, 5).toString() === '%PDF-' && /%%EOF\s*$/.test(buffer.subarray(-1024).toString());
  if (png && extension === '.png' && mime === 'image/png') return 'image/png';
  if (jpg && ['.jpg', '.jpeg'].includes(extension) && mime === 'image/jpeg') return 'image/jpeg';
  if (pdf && extension === '.pdf' && mime === 'application/pdf' && !['FOTO', 'LOGO'].includes(categoria))
    return 'application/pdf';
  throw new BadRequestException(
    'Firma, extensión o MIME no válidos. Admite PNG/JPEG y PDF; fotos y logos solo imágenes.',
  );
}
export function escanearArchivo(ruta: string): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile('clamdscan', ['--no-summary', '--', ruta], { timeout: 30000, maxBuffer: 4096 }, (error) => {
      if (error)
        reject(new ServiceUnavailableException('El antivirus rechazó el archivo o no está disponible; no se publicó.'));
      else resolve();
    });
  });
}
