import { BadRequestException } from '@nestjs/common';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { randomUUID } from 'crypto';

/** Límites del contrato: formatos y pesos definidos, sin almacenamiento ilimitado. */
const EXTENSIONES_PERMITIDAS = [
  '.pdf', '.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx',
  '.png', '.jpg', '.jpeg', '.zip', '.txt',
];

// Evaluación perezosa: se lee al recibir cada archivo, con el .env ya cargado.
const dirDestino = () => process.env.UPLOADS_DIR || './uploads';
const maxBytes = () => (Number(process.env.MAX_UPLOAD_MB) || 5) * 1024 * 1024;

export const uploadConfig = {
  storage: diskStorage({
    destination: (_req, _file, cb) => cb(null, dirDestino()),
    filename: (_req, file, cb) => cb(null, `${randomUUID()}${extname(file.originalname).toLowerCase()}`),
  }),
  limits: { fileSize: maxBytes() },
  fileFilter: (_req: unknown, file: Express.Multer.File, cb: (e: Error | null, ok: boolean) => void) => {
    const ext = extname(file.originalname).toLowerCase();
    if (EXTENSIONES_PERMITIDAS.includes(ext)) return cb(null, true);
    cb(new BadRequestException(`Formato no permitido: ${ext}`), false);
  },
};
