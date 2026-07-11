import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, JwtUser } from '../common/current-user.decorator';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { Roles } from '../common/roles.decorator';
import { RolesGuard } from '../common/roles.guard';
import { CalendarioService } from './calendario.service';
import { EventoDto } from './calendario.dto';

@ApiTags('calendario')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('calendario')
export class CalendarioController {
  constructor(private readonly service: CalendarioService) {}

  @Get()
  listar(
    @CurrentUser() user: JwtUser,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
    @Query('plantelId') plantelId?: string,
  ) { return this.service.listar(user, desde, hasta, plantelId ? Number(plantelId) : undefined); }

  @Post()
  @Roles('ADMINISTRATIVO', 'MAESTRO')
  crear(@Body() dto: EventoDto, @CurrentUser() user: JwtUser) { return this.service.crear(dto, user); }

  @Delete(':id')
  @Roles('ADMINISTRATIVO', 'MAESTRO')
  eliminar(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) {
    return this.service.eliminar(id, user);
  }
}
