import { BadRequestException } from '@nestjs/common';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { randomUUID } from 'crypto';
import { uploadsPath } from './uploads-path';

/** Límites del contrato: formatos y pesos definidos, sin almacenamiento ilimitado. */
const EXTENSIONES_PERMITIDAS = [
  '.pdf', '.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx',
  '.png', '.jpg', '.jpeg', '.zip', '.txt',
];

// Evaluación perezosa: se lee al recibir cada archivo, con el .env ya cargado.
const dirDestino = () => uploadsPath();
const maxBytes = () => (Number(process.env.MAX_UPLOAD_MB) || 5) * 1024 * 1024;

export const uploadConfig = {
  storage: diskStorage({
    destination: (_req, _file, cb) => cb(null, dirDestino()),
    filename: (_req, file, cb) => cb(null, `${randomUUID()}${extname(file.originalname).toLowerCase()}`),
  }),
  get limits() { return { fileSize: maxBytes() }; },
  fileFilter: (_req: unknown, file: Express.Multer.File, cb: (e: Error | null, ok: boolean) => void) => {
    // Busboy interpreta filename como Latin-1; los clientes envían normalmente UTF-8.
    const bytes = Buffer.from(file.originalname, 'latin1'), utf8 = bytes.toString('utf8');
    if (Array.from(file.originalname).every((c) => c.charCodeAt(0) <= 255) && Buffer.from(utf8, 'utf8').equals(bytes)) file.originalname = utf8;
    if (file.originalname.length > 200) return cb(new BadRequestException('El nombre del archivo supera 200 caracteres'), false);
    const ext = extname(file.originalname).toLowerCase();
    if (EXTENSIONES_PERMITIDAS.includes(ext)) return cb(null, true);
    cb(new BadRequestException(`Formato no permitido: ${ext}`), false);
  },
};
