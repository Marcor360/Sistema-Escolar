import { BadRequestException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { extname } from 'path';
import { diskStorage } from 'multer';
import { uploadsPath } from '../common/uploads-path';

export const logoPdfUploadConfig = {
  storage: diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadsPath()),
    filename: (_req, _file, cb) => cb(null, 'marca-pdf-temporal-' + randomUUID() + '.png'),
  }),
  limits: { fileSize: 3 * 1024 * 1024, files: 1 },
  fileFilter: (_req: unknown, file: Express.Multer.File, cb: (error: Error | null, accept: boolean) => void) => {
    if (file.fieldname === 'logoPdf' && extname(file.originalname).toLowerCase() === '.png') return cb(null, true);
    cb(new BadRequestException('Se requiere la variante PNG del logo para impresión'), false);
  },
};
