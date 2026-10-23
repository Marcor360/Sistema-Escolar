import { ImportacionCalificacionesService } from '../calificaciones/importacion-calificaciones.service';
import { Controller, Get, Param, ParseIntPipe, Query, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import type { Response } from 'express';
import { ReportesService } from './reportes.service';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { CurrentUser, JwtUser } from '../common/current-user.decorator';

@ApiTags('reportes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('reportes')
export class ReportesController {
  constructor(private readonly service: ReportesService, private readonly plantillas: ImportacionCalificacionesService) {}

  @Get('resumen')
  @Roles('ADMINISTRATIVO', 'FINANZAS')
  resumen(@CurrentUser() user: JwtUser, @Query('plantelId') plantelId?: string) {
    return this.service.resumen(user, plantelId ? Number(plantelId) : undefined);
  }

  @Get('boleta/:alumnoId')
  @Roles('ADMINISTRATIVO', 'ALUMNO')
  boleta(@Param('alumnoId', ParseIntPipe) alumnoId: number, @CurrentUser() user: JwtUser, @Res() res: Response, @Query('cicloId', new ParseIntPipe({ optional: true })) cicloId?: number, @Query('inscripcionId', new ParseIntPipe({ optional: true })) inscripcionId?: number) {
    return this.service.boletaPdf(alumnoId, user, res, cicloId, inscripcionId);
  }

  @Get('grupo-materias/:id/calificaciones.xlsx')
  @Roles('MAESTRO', 'ADMINISTRATIVO')
  calificacionesExcel(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: JwtUser,
    @Res() res: Response,
  ) {
    return this.service.calificacionesExcel(id, user, res);
  }

  @Get('grupo-materias/:id/plantilla-calificaciones.xlsx')
  @ApiOperation({ summary: 'Plantilla XLSX de clase y parcial o Final, compatible con el importador de notas' })
  @Roles('MAESTRO', 'ADMINISTRATIVO')
  async plantillaCalificaciones(@Param('id', ParseIntPipe) id: number, @Query('parcial', ParseIntPipe) parcial: number, @CurrentUser() user: JwtUser, @Res() res: Response) {
    const archivo = await this.plantillas.plantilla({ grupoMateriaId: id, parcial }, user);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="plantilla-calificaciones-${id}-${parcial}.xlsx"`);
    res.send(archivo);
  }

  @Get('adeudos.xlsx')
  @Roles('FINANZAS', 'ADMINISTRATIVO')
  adeudos(@CurrentUser() user: JwtUser, @Res() res: Response, @Query('plantelId') plantelId?: string) {
    return this.service.adeudosExcel(user, res, plantelId ? Number(plantelId) : undefined);
  }
  @Get('me/estado-cuenta.pdf')
  @ApiOperation({ summary: 'Descargar estado de cuenta PDF del alumno autenticado' })
  @Roles('ALUMNO')
  miEstadoCuentaPdf(@CurrentUser() user: JwtUser, @Res() res: Response) {
    return this.service.miEstadoCuentaPdf(user, res);
  }

  @Get('estado-cuenta/:alumnoId/pdf')
  @ApiOperation({ summary: 'Descargar estado de cuenta PDF de alumno dentro del alcance financiero' })
  @Roles('FINANZAS', 'ADMINISTRATIVO')
  estadoCuentaPdf(@Param('alumnoId', ParseIntPipe) alumnoId: number, @CurrentUser() user: JwtUser, @Res() res: Response) {
    return this.service.estadoCuentaPdf(alumnoId, user, res);
  }

  @Get('bajas.xlsx')
  @ApiOperation({ summary: 'Descargar listado de bajas actuales por plantel autorizado; no es historial de eventos' })
  @Roles('FINANZAS', 'ADMINISTRATIVO')
  bajasExcel(@CurrentUser() user: JwtUser, @Res() res: Response, @Query('plantelId', new ParseIntPipe({ optional: true })) plantelId?: number) {
    return this.service.bajasExcel(user, res, plantelId);
  }

  @Get('cobranza/serie')
  @ApiOperation({ summary: 'Serie mensual de pagos confirmados de los últimos seis meses, por plantel de origen' })
  @Roles('FINANZAS')
  cobranzaMensual(@CurrentUser() user: JwtUser, @Query('plantelId', new ParseIntPipe({ optional: true })) plantelId?: number) {
    return this.service.serieCobranza(user, plantelId);
  }

}
