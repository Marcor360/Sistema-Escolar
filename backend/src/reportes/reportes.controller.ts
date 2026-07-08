import { Controller, Get, Param, ParseIntPipe, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
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
  constructor(private readonly service: ReportesService) {}

  @Get('resumen')
  @Roles('ADMINISTRATIVO', 'FINANZAS', 'MAESTRO')
  resumen() {
    return this.service.resumen();
  }

  @Get('boleta/:alumnoId')
  @Roles('ADMINISTRATIVO', 'MAESTRO', 'FINANZAS', 'ALUMNO')
  boleta(@Param('alumnoId', ParseIntPipe) alumnoId: number, @Res() res: Response) {
    return this.service.boletaPdf(alumnoId, res);
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

  @Get('adeudos.xlsx')
  @Roles('FINANZAS', 'ADMINISTRATIVO')
  adeudos(@Res() res: Response) {
    return this.service.adeudosExcel(res);
  }
}
