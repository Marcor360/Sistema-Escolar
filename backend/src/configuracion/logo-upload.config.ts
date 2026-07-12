import { BadRequestException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { diskStorage } from 'multer';
import { extname } from 'path';

const EXTENSIONES_PERMITIDAS = ['.png', '.jpg', '.jpeg', '.webp'];
const dirDestino = () => process.env.UPLOADS_DIR || './uploads';

export const logoUploadConfig = {
  storage: diskStorage({
    destination: (_req, _file, cb) => cb(null, dirDestino()),
    filename: (_req, file, cb) =>
      cb(null, `marca-logo-${randomUUID()}${extname(file.originalname).toLowerCase()}`),
  }),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req: unknown, file: Express.Multer.File, cb: (e: Error | null, ok: boolean) => void) => {
    const ext = extname(file.originalname).toLowerCase();
    if (EXTENSIONES_PERMITIDAS.includes(ext)) return cb(null, true);
    cb(new BadRequestException(`Formato no permitido: ${ext}`), false);
  },
};
