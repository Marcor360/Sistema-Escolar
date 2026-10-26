import { Body, Controller, Get, Param, ParseIntPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { CurrentUser, JwtUser } from '../common/current-user.decorator';
import { AsistenciasService } from './asistencias.service';
import { CapturaAsistenciaDto, ConsultaAsistenciaDto } from './asistencias.dto';
@ApiTags('asistencias')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('asistencias')
export class AsistenciasController {
  constructor(private readonly service: AsistenciasService) {}
  @Get('clases') @Roles('MAESTRO', 'ADMINISTRATIVO') clases(@CurrentUser() u: JwtUser) {
    return this.service.clases(u);
  }
  @Get('lista') @Roles('MAESTRO', 'ADMINISTRATIVO') lista(
    @Query() q: ConsultaAsistenciaDto,
    @CurrentUser() u: JwtUser,
  ) {
    return this.service.lista(q.grupoMateriaId ?? 0, q.desde ?? '', u);
  }
  @Get() @Roles('ALUMNO', 'MAESTRO', 'ADMINISTRATIVO') consultar(
    @Query() q: ConsultaAsistenciaDto,
    @CurrentUser() u: JwtUser,
  ) {
    return this.service.consultar(q, u);
  }
  @Post() @Roles('MAESTRO') capturar(@Body() d: CapturaAsistenciaDto, @CurrentUser() u: JwtUser) {
    return this.service.capturar(d, u);
  }
  @Get(':id/historial') @Roles('MAESTRO', 'ADMINISTRATIVO') historial(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() u: JwtUser,
  ) {
    return this.service.historial(id, u);
  }
}
