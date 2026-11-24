import { BoletasService } from '../boletas/boletas.service';
import { BadRequestException } from '@nestjs/common';
import { contentDisposition } from '../common/content-disposition';
import { FormatosEscolaresService } from './formatos-escolares.service';
import { Controller, Get, Param, ParseIntPipe, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { ArchivosService } from '../archivos/archivos.service';
import { AlumnosService } from '../alumnos/alumnos.service';
import { ReportesService } from './reportes.service';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { CurrentUser, JwtUser } from '../common/current-user.decorator';
@Controller('reportes')
export class BoletaMovilController {
  constructor(
    private readonly archivos: ArchivosService,
    private readonly alumnos: AlumnosService,
    private readonly reportes: ReportesService,
    private readonly formatos: FormatosEscolaresService,
    private readonly boletas: BoletasService,
  ) {}
  @Get('mis-boletas')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ALUMNO')
  listar(@CurrentUser() user: JwtUser) {
    return this.reportes.misBoletas(user);
  }

  @Get('mi-boleta/enlace')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ALUMNO')
  async enlace(
    @CurrentUser() user: JwtUser,
    @Query('cicloId', new ParseIntPipe({ optional: true })) cicloId?: number,
    @Query('inscripcionId', new ParseIntPipe({ optional: true })) inscripcionId?: number,
    @Query('formato') formato?: string,
    @Query('respuestaId', new ParseIntPipe({ optional: true })) respuestaId?: number,
  ) {
    const alumno = await this.alumnos.obtenerPorUsuario(user.sub);
    if (formato && !['informativa-pdf', 'informativa-excel', 'constancia-aceptacion', 'boleta-oficial'].includes(formato))
      throw new BadRequestException('Formato de boleta no admitido');
    if (formato === 'constancia-aceptacion' || formato === 'boleta-oficial') {
      if (!inscripcionId || !respuestaId) throw new BadRequestException('Selecciona la inscripción y aceptación');
      if (formato === 'boleta-oficial') await this.boletas.oficial(inscripcionId, respuestaId, user);
      else await this.boletas.constancia(inscripcionId, respuestaId, user);
    }
    return this.archivos.enlaceBoleta(
      alumno.id,
      cicloId,
      inscripcionId,
      user,
      formato as 'informativa-pdf' | 'informativa-excel' | 'constancia-aceptacion' | 'boleta-oficial' | undefined,
      respuestaId,
    );
  }
  @Get('boleta-descarga/:id')
  async descargar(@Param('id', ParseIntPipe) id: number, @Query('t') token: string, @Res() res: Response) {
    const { user, cicloId, inscripcionId, formatoBoleta, respuestaId } = await this.archivos.usuarioBoleta(id, token);
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('Referrer-Policy', 'no-referrer');
    if (formatoBoleta === 'constancia-aceptacion' || formatoBoleta === 'boleta-oficial') {
      if (!inscripcionId || !respuestaId) throw new BadRequestException('Constancia inválida');
      const oficial = formatoBoleta === 'boleta-oficial';
      const buffer = oficial ? await this.boletas.oficial(inscripcionId, respuestaId, user) : await this.boletas.constancia(inscripcionId, respuestaId, user);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', contentDisposition(`${oficial ? 'boleta-oficial' : 'constancia-boleta'}-${respuestaId}.pdf`, 'attachment'));
      res.setHeader('X-Content-Type-Options', 'nosniff');
      return res.send(buffer);
    }
    if (formatoBoleta) {
      const excel = formatoBoleta === 'informativa-excel';
      const buffer = excel
        ? await this.formatos.boletaExcel(id, user, inscripcionId, cicloId)
        : await this.formatos.boletaPdf(id, user, inscripcionId, cicloId);
      res.setHeader(
        'Content-Type',
        excel ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'application/pdf',
      );
      res.setHeader('Content-Disposition', contentDisposition(`boleta-${id}.${excel ? 'xlsx' : 'pdf'}`, 'attachment'));
      res.setHeader('X-Content-Type-Options', 'nosniff');
      return res.send(buffer);
    }
    return this.reportes.boletaPdf(id, user, res, cicloId, inscripcionId);
  }
}
