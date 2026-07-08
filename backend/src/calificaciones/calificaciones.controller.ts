import { Body, Controller, Get, Param, ParseIntPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CalificacionesService } from './calificaciones.service';
import { CapturaCalificacionesDto } from './calificaciones.dto';
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

  @Get('grupo-materia/:id')
  @Roles('MAESTRO', 'ADMINISTRATIVO')
  porGrupoMateria(@Param('id', ParseIntPipe) id: number, @Query('parcial') parcial?: string) {
    return this.service.porGrupoMateria(id, parcial !== undefined ? Number(parcial) : undefined);
  }

  @Get('alumno/:id')
  @Roles('ADMINISTRATIVO', 'MAESTRO', 'FINANZAS')
  porAlumno(@Param('id', ParseIntPipe) id: number) {
    return this.service.porAlumno(id);
  }
}
