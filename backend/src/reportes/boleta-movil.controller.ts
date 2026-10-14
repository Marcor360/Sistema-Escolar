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
  ) {
    const alumno = await this.alumnos.obtenerPorUsuario(user.sub);
    return this.archivos.enlaceBoleta(alumno.id, cicloId, inscripcionId, user);
  }
  @Get('boleta-descarga/:id')
  async descargar(@Param('id', ParseIntPipe) id: number, @Query('t') token: string, @Res() res: Response) {
    const { user, cicloId, inscripcionId } = await this.archivos.usuarioBoleta(id, token);
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('Referrer-Policy', 'no-referrer');
    return this.reportes.boletaPdf(id, user, res, cicloId, inscripcionId);
  }
}
