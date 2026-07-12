import { BadRequestException, Controller, Get, Param, Res } from '@nestjs/common';
import type { Response } from 'express';
import { join } from 'path';

/** Sirve únicamente logos de marca; el resto de uploads conserva enlaces firmados. */
@Controller('uploads')
export class LogoPublicoController {
  @Get(':filename')
  descargar(@Param('filename') filename: string, @Res() res: Response) {
    if (!/^marca-logo-[0-9a-f-]+\.(png|jpe?g|webp)$/i.test(filename)) {
      throw new BadRequestException('Archivo de marca no válido');
    }
    return res.sendFile(filename, { root: join(process.cwd(), process.env.UPLOADS_DIR || 'uploads') });
  }
}
