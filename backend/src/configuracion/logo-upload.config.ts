import { BadRequestException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { uploadsPath } from '../common/uploads-path';
import { diskStorage } from 'multer';
import { extname } from 'path';

const EXTENSIONES_PERMITIDAS = ['.webp'];
const dirDestino = () => uploadsPath();

export const logoUploadConfig = {
  storage: diskStorage({
    destination: (_req, _file, cb) => cb(null, dirDestino()),
    filename: (_req, file, cb) =>
      cb(null, `marca-temporal-${randomUUID()}.webp`),
  }),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (_req: unknown, file: Express.Multer.File, cb: (e: Error | null, ok: boolean) => void) => {
    const ext = extname(file.originalname).toLowerCase();
    if (EXTENSIONES_PERMITIDAS.includes(ext)) return cb(null, true);
    cb(new BadRequestException('El servidor requiere un logo WebP optimizado desde el portal'), false);
  },
};
