import { BadRequestException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { uploadsPath } from '../common/uploads-path';

export const faviconUploadConfig = {
  storage: diskStorage({
    destination: (_req, _file, callback) => callback(null, uploadsPath()),
    filename: (_req, _file, callback) => callback(null, `favicon-temporal-${randomUUID()}.png`),
  }),
  limits: { fileSize: 512 * 1024, files: 1 },
  fileFilter: (_req: unknown, file: Express.Multer.File, callback: (error: Error | null, accept: boolean) => void) => {
    if (extname(file.originalname).toLowerCase() === '.png' && file.mimetype === 'image/png') return callback(null, true);
    callback(new BadRequestException('Se requiere favicon PNG'), false);
  },
};
