import { Body, Controller, Get, Param, ParseIntPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { CurrentUser, JwtUser } from '../common/current-user.decorator';
import { ConductaService } from './conducta.service';
import { CrearIncidenciaDto, ListarIncidenciasDto, SeguimientoIncidenciaDto } from './conducta.dto';
@ApiTags('conducta interna') @ApiBearerAuth()
@Controller('conducta/incidencias') @UseGuards(JwtAuthGuard, RolesGuard) @Roles('ADMINISTRATIVO', 'MAESTRO')
export class ConductaController {
  constructor(private readonly service: ConductaService) {}
  @Get() listar(@Query() query: ListarIncidenciasDto, @CurrentUser() user: JwtUser) { return this.service.listar(query, user); }
  @Get(':id') detalle(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) { return this.service.detalle(id, user); }
  @Post() crear(@Body() dto: CrearIncidenciaDto, @CurrentUser() user: JwtUser) { return this.service.crear(dto, user); }
  @Post(':id/seguimientos') seguir(@Param('id', ParseIntPipe) id: number, @Body() dto: SeguimientoIncidenciaDto, @CurrentUser() user: JwtUser) { return this.service.seguir(id, dto, user); }
}
