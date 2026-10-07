import { PaginacionDto } from '../common/paginacion.dto';
import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
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

  @ApiOperation({ summary: 'Calificaciones propias del ciclo vigente; cicloId explícito para historial' })
  @ApiResponse({ status: 400, description: 'Datos o transición inválidos' })
  @ApiResponse({ status: 401, description: 'Sesión expirada o revocada' })
  @ApiResponse({ status: 403, description: 'Rol, portal, alcance u origen no autorizado' })
  @ApiResponse({ status: 409, description: 'Conflicto con el estado actual' })
  @Get('mias')
  @Roles('ALUMNO')
  mias(@CurrentUser() user: JwtUser, @Query('cicloId', new ParseIntPipe({ optional: true })) cicloId?: number) {
    return this.service.mias(user, cicloId);
  }

  @ApiOperation({ summary: 'Captura oficial transaccional; corregir una nota exige motivo' })
  @ApiResponse({ status: 400, description: 'Datos o transición inválidos' })
  @ApiResponse({ status: 401, description: 'Sesión expirada o revocada' })
  @ApiResponse({ status: 403, description: 'Rol, portal, alcance u origen no autorizado' })
  @ApiResponse({ status: 409, description: 'Conflicto con el estado actual' })
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

  @ApiOperation({ summary: 'Cerrar sin faltantes o reabrir mediante control escolar' })
  @ApiResponse({ status: 400, description: 'Datos o transición inválidos' })
  @ApiResponse({ status: 401, description: 'Sesión expirada o revocada' })
  @ApiResponse({ status: 403, description: 'Rol, portal, alcance u origen no autorizado' })
  @ApiResponse({ status: 409, description: 'Conflicto con el estado actual' })
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
    @Query() query: PaginacionDto,
    @Param('grupoMateriaId', ParseIntPipe) grupoMateriaId: number,
    @Param('parcial', ParseIntPipe) parcial: number,
    @CurrentUser() user: JwtUser,
  ) {
    return this.service.historialPeriodo(grupoMateriaId, parcial, user, query);
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
  porAlumno(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser, @Query('cicloId', new ParseIntPipe({ optional: true })) cicloId?: number) {
    return this.service.porAlumno(id, user, cicloId);
  }
}
