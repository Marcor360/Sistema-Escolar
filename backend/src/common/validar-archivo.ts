import { BadRequestException } from '@nestjs/common';
import { open } from 'fs/promises';
import { extname } from 'path';

/** Inspección de firmas antes de guardar la referencia; no confía en MIME declarado por el navegador. */
export async function validarContenidoArchivo(archivo: Express.Multer.File): Promise<void> {
  const handle = await open(archivo.path, 'r');
  let bytes: Buffer;
  try {
    const buffer = Buffer.alloc(8192);
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    bytes = buffer.subarray(0, bytesRead);
  } finally { await handle.close(); }
  const ext = extname(archivo.originalname).toLowerCase();
  const firma = bytes.subarray(0, 8).toString('hex');
  const zip = firma.startsWith('504b0304') || firma.startsWith('504b0506');
  const ole = firma === 'd0cf11e0a1b11ae1';
  const valido = ext === '.pdf' ? bytes.subarray(0, 5).toString() === '%PDF-'
    : ext === '.png' ? firma === '89504e470d0a1a0a'
    : ext === '.webp' ? bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP'
    : ['.jpg', '.jpeg'].includes(ext) ? firma.startsWith('ffd8ff')
    : ['.doc', '.xls', '.ppt'].includes(ext) ? ole
    : ['.docx', '.xlsx', '.pptx', '.zip'].includes(ext) ? zip
    : ext === '.txt' ? bytes.length > 0 && !bytes.includes(0) && !bytes.toString('utf8').includes('�')
    : false;
  if (!valido) throw new BadRequestException('El contenido del archivo no corresponde al formato permitido');
}
