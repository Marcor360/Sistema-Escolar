import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, JwtUser } from '../common/current-user.decorator';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { Roles } from '../common/roles.decorator';
import { RolesGuard } from '../common/roles.guard';
import { CalendarioService } from './calendario.service';
import { EditarEventoDto, EventoDto } from './calendario.dto';

@ApiTags('calendario')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('calendario')
export class CalendarioController {
  constructor(private readonly service: CalendarioService) {}

  @Get()
  @Roles('ALUMNO', 'MAESTRO', 'ADMINISTRATIVO')
  listar(
    @CurrentUser() user: JwtUser,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
    @Query('plantelId', new ParseIntPipe({ optional: true })) plantelId?: number,
  ) { return this.service.listar(user, desde, hasta, plantelId); }

  @Post()
  @Roles('ADMINISTRATIVO', 'MAESTRO')
  crear(@Body() dto: EventoDto, @CurrentUser() user: JwtUser) { return this.service.crear(dto, user); }

  @Patch(':id')
  @ApiOperation({ summary: 'Editar contenido y fechas de un evento en su mismo plantel y grupo' })
  @Roles('ADMINISTRATIVO', 'MAESTRO')
  editar(@Param('id', ParseIntPipe) id: number, @Body() dto: EditarEventoDto, @CurrentUser() user: JwtUser) {
    return this.service.editar(id, dto, user);
  }

  @Delete(':id')
  @Roles('ADMINISTRATIVO', 'MAESTRO')
  eliminar(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) {
    return this.service.eliminar(id, user);
  }
}
