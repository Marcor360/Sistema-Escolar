import { BadRequestException } from '@nestjs/common';
import { open } from 'fs/promises';
import { TextDecoder } from 'util';
import { extname } from 'path';

/** Inspección de firmas antes de guardar la referencia; no confía en MIME declarado por el navegador. */
export async function validarContenidoArchivo(archivo: Express.Multer.File): Promise<void> {
  const handle = await open(archivo.path, 'r');
  let bytes: Buffer;
  let muestraCompleta = false;
  try {
    const buffer = Buffer.alloc(8192);
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    bytes = buffer.subarray(0, bytesRead);
    muestraCompleta = bytesRead === (await handle.stat()).size;
  } finally {
    await handle.close();
  }
  const ext = extname(archivo.originalname).toLowerCase();
  const firma = bytes.subarray(0, 8).toString('hex');
  const zip = firma.startsWith('504b0304') || firma.startsWith('504b0506');
  const ole = firma === 'd0cf11e0a1b11ae1';
  const textoUtf8 = () => {
    if (!bytes.length || bytes.includes(0)) return false;
    try {
      new TextDecoder('utf-8', { fatal: true }).decode(bytes, { stream: !muestraCompleta });
      return true;
    } catch {
      return false;
    }
  };
  const valido =
    ext === '.pdf'
      ? bytes.subarray(0, 5).toString() === '%PDF-'
      : ext === '.png'
        ? firma === '89504e470d0a1a0a'
        : ext === '.webp'
          ? bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP'
          : ['.jpg', '.jpeg'].includes(ext)
            ? firma.startsWith('ffd8ff')
            : ['.doc', '.xls', '.ppt'].includes(ext)
              ? ole
              : ['.docx', '.xlsx', '.pptx', '.odt', '.ods', '.odp', '.zip'].includes(ext)
                ? zip
                : ext === '.gif'
                  ? ['GIF87a', 'GIF89a'].includes(bytes.subarray(0, 6).toString())
                  : ext === '.bmp'
                    ? bytes.subarray(0, 2).toString() === 'BM'
                    : ext === '.rtf'
                      ? bytes.subarray(0, 5).toString() === '{\\rtf'
                      : ext === '.wav'
                        ? bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WAVE'
                        : ext === '.mp3'
                          ? bytes.subarray(0, 3).toString() === 'ID3' ||
                            (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0)
                          : ['.mp4', '.m4a'].includes(ext)
                            ? bytes.subarray(4, 8).toString() === 'ftyp'
                            : ['.txt', '.csv', '.md'].includes(ext)
                              ? textoUtf8()
                              : false;
  if (!valido) throw new BadRequestException('El contenido del archivo no corresponde al formato permitido');
}
