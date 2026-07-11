import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { DocentesService } from './docentes.service';
import { ActualizarDocenteDto, CrearDocenteDto } from './docentes.dto';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { CurrentUser, JwtUser } from '../common/current-user.decorator';

@ApiTags('docentes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMINISTRATIVO')
@Controller('docentes')
export class DocentesController {
  constructor(private readonly service: DocentesService) {}

  @Get() listar(@CurrentUser() user: JwtUser, @Query('plantelId') plantelId?: string) {
    return this.service.listar(user, plantelId ? Number(plantelId) : undefined);
  }
  @Get(':id') obtener(@Param('id', ParseIntPipe) id: number) { return this.service.obtener(id); }
  @Post() crear(@Body() dto: CrearDocenteDto, @CurrentUser() user: JwtUser) { return this.service.crear(dto, user); }
  @Patch(':id') actualizar(@Param('id', ParseIntPipe) id: number, @Body() dto: ActualizarDocenteDto) {
    return this.service.actualizar(id, dto);
  }
  @Delete(':id') baja(@Param('id', ParseIntPipe) id: number) { return this.service.baja(id); }
}
