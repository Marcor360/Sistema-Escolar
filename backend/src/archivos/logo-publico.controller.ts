import { BadRequestException, Controller, Get, Param, Res } from '@nestjs/common';
import type { Response } from 'express';
import { uploadsPath } from '../common/uploads-path';

/** Sirve únicamente logos de marca; el resto de uploads conserva enlaces firmados. */
@Controller('uploads')
export class LogoPublicoController {
  @Get(':filename')
  descargar(@Param('filename') filename: string, @Res() res: Response) {
    if (!/^marca-logo-[0-9a-f-]+\.(png|jpe?g|webp)$/i.test(filename)) {
      throw new BadRequestException('Archivo de marca no válido');
    }
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    // El portal y la API pueden usar dominios distintos. Helmet aplica same-origin
    // por defecto; se permite incrustar solo este recurso público de marca.
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    return res.sendFile(filename, { root: uploadsPath() });
  }
}
