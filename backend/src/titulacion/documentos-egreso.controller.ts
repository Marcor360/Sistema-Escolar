import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseIntPipe,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { CurrentUser, JwtUser } from '../common/current-user.decorator';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { DocumentosEgresoService } from './documentos-egreso.service';
import { EvidenciaDto, ExpedicionDto } from './documentos-egreso.dto';

@Controller('expedientes-egreso')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('DIRECTOR', 'ADMINISTRATIVO', 'FINANZAS')
export class DocumentosEgresoController {
  constructor(private service: DocumentosEgresoService) {}
  @Get(':matricula')
  @Header('Cache-Control', 'private, no-store')
  consultar(@Param('matricula') matricula: string, @CurrentUser() actor: JwtUser) {
    return this.service.consultar(matricula, actor);
  }
  @Post(':matricula/evidencias')
  @UseInterceptors(
    FileInterceptor('archivo', { limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 2, fieldSize: 4096 } }),
  )
  evidencia(
    @Param('matricula') matricula: string,
    @Body() d: EvidenciaDto,
    @UploadedFile() archivo: Express.Multer.File,
    @CurrentUser() actor: JwtUser,
  ) {
    return this.service.evidencia(matricula, d, archivo, actor);
  }
  @Post(':matricula/documentos')
  @Header('Cache-Control', 'private, no-store')
  expedir(@Param('matricula') matricula: string, @Body() d: ExpedicionDto, @CurrentUser() actor: JwtUser) {
    return this.service.expedir(matricula, d, actor);
  }
  @Get(':matricula/archivo')
  async archivo(@Param('matricula') matricula: string, @CurrentUser() actor: JwtUser, @Res() res: Response) {
    const bytes = await this.service.archivo(matricula, actor);
    res
      .set({
        'Cache-Control': 'private, no-store',
        'Content-Type': 'application/gzip',
        'Content-Disposition': 'attachment; filename="expediente.json.gz"',
      })
      .send(bytes);
  }
  @Get(':matricula/documentos/:id/historial')
  async historial(
    @Param('matricula') matricula: string,
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() actor: JwtUser,
    @Res() res: Response,
  ) {
    const bytes = await this.service.instantanea(matricula, id, actor);
    res
      .set({
        'Cache-Control': 'private, no-store',
        'Content-Type': 'application/json',
        'Content-Disposition': 'attachment; filename="historial.json"',
      })
      .send(bytes);
  }
  @Get(':matricula/documentos/:id')
  async descargar(
    @Param('matricula') matricula: string,
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() actor: JwtUser,
    @Res() res: Response,
  ) {
    const d = await this.service.descargar(matricula, id, actor);
    res
      .set({
        'Cache-Control': 'private, no-store',
        'Content-Type': d.mime,
        'Content-Disposition': 'attachment; filename="' + d.nombre + '"',
        'X-Content-Type-Options': 'nosniff',
      })
      .send(d.bytes);
  }
}
