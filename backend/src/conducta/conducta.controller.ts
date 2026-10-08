import { ApiErroresOperacion } from '../common/api-operacion';
import { ListaIncidenciaRespuestaDto, DetalleIncidenciaRespuestaDto, IncidenciaRespuestaDto, OperacionRespuestaDto } from './respuestas.dto';
import { Body, Controller, Get, Param, ParseIntPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiOkResponse, ApiCreatedResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { CurrentUser, JwtUser } from '../common/current-user.decorator';
import { ConductaService } from './conducta.service';
import { CrearIncidenciaDto, ListarIncidenciasDto, SeguimientoIncidenciaDto } from './conducta.dto';
@ApiErroresOperacion() @ApiTags('conducta interna') @ApiBearerAuth()
@Controller('conducta/incidencias') @UseGuards(JwtAuthGuard, RolesGuard) @Roles('ADMINISTRATIVO', 'MAESTRO')
export class ConductaController {
  constructor(private readonly service: ConductaService) {}
  @ApiOperation({ summary: 'Lista paginada exclusivamente interna por plantel/clases propias' })
  @ApiOkResponse({ type: ListaIncidenciaRespuestaDto })
  @Get() listar(@Query() query: ListarIncidenciasDto, @CurrentUser() user: JwtUser) { return this.service.listar(query, user); }
  @ApiOperation({ summary: 'Detalle y notas internas; no disponible a alumno ni Finanzas' })
  @ApiOkResponse({ type: DetalleIncidenciaRespuestaDto })
  @Get(':id') detalle(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) { return this.service.detalle(id, user); }
  @ApiOperation({ summary: 'Registrar incidencia de alumno con inscripción vigente en clase autorizada' })
  @ApiCreatedResponse({ type: IncidenciaRespuestaDto })
  @Post() crear(@Body() dto: CrearIncidenciaDto, @CurrentUser() user: JwtUser) { return this.service.crear(dto, user); }
  @ApiOperation({ summary: 'Seguimiento interno; cierre/anulación solo control escolar y sin borrar historial' })
  @ApiCreatedResponse({ type: OperacionRespuestaDto })
  @Post(':id/seguimientos') seguir(@Param('id', ParseIntPipe) id: number, @Body() dto: SeguimientoIncidenciaDto, @CurrentUser() user: JwtUser) { return this.service.seguir(id, dto, user); }
}
