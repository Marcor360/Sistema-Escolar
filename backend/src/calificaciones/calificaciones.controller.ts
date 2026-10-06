import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CalificacionesService } from './calificaciones.service';
import { CambiarEstadoPeriodoDto, CapturaCalificacionesDto } from './calificaciones.dto';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { CurrentUser, JwtUser } from '../common/current-user.decorator';

@ApiTags('calificaciones')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('calificaciones')
export class CalificacionesController {
  constructor(private readonly service: CalificacionesService) {}

  @Get('mias')
  @Roles('ALUMNO')
  mias(@CurrentUser() user: JwtUser) {
    return this.service.mias(user);
  }

  @Post('captura')
  @Roles('MAESTRO', 'ADMINISTRATIVO')
  capturar(@Body() dto: CapturaCalificacionesDto, @CurrentUser() user: JwtUser) {
    return this.service.capturar(dto, user);
  }

  @Get('periodos/:grupoMateriaId/:parcial')
  @Roles('MAESTRO', 'ADMINISTRATIVO')
  estadoPeriodo(
    @Param('grupoMateriaId', ParseIntPipe) grupoMateriaId: number,
    @Param('parcial', ParseIntPipe) parcial: number,
    @CurrentUser() user: JwtUser,
  ) {
    return this.service.estadoPeriodo(grupoMateriaId, parcial, user);
  }

  @Patch('periodos/:grupoMateriaId/:parcial')
  @Roles('ADMINISTRATIVO')
  cambiarEstadoPeriodo(
    @Param('grupoMateriaId', ParseIntPipe) grupoMateriaId: number,
    @Param('parcial', ParseIntPipe) parcial: number,
    @Body() dto: CambiarEstadoPeriodoDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.service.cambiarEstadoPeriodo(grupoMateriaId, parcial, dto.estatus, user);
  }

  @Get('periodos/:grupoMateriaId/:parcial/historial')
  @Roles('MAESTRO', 'ADMINISTRATIVO')
  historialPeriodo(
    @Param('grupoMateriaId', ParseIntPipe) grupoMateriaId: number,
    @Param('parcial', ParseIntPipe) parcial: number,
    @CurrentUser() user: JwtUser,
  ) {
    return this.service.historialPeriodo(grupoMateriaId, parcial, user);
  }

  @Get('grupo-materia/:id')
  @Roles('MAESTRO', 'ADMINISTRATIVO')
  porGrupoMateria(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: JwtUser,
    @Query('parcial') parcial?: string,
  ) {
    return this.service.porGrupoMateria(id, user, parcial !== undefined ? Number(parcial) : undefined);
  }

  @Get('alumno/:id')
  @Roles('ADMINISTRATIVO', 'MAESTRO')
  porAlumno(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) {
    return this.service.porAlumno(id, user);
  }
}
