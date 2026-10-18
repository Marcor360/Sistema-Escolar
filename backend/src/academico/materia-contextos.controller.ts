import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, Min } from 'class-validator';
import { CurrentUser, JwtUser } from '../common/current-user.decorator';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { Roles } from '../common/roles.decorator';
import { RolesGuard } from '../common/roles.guard';
import { PaginacionDto } from '../common/paginacion.dto';
import { ApiErroresOperacion } from '../common/api-operacion';
import { MateriaContextosService } from './materia-contextos.service';
export class VincularMateriaPeriodoDto {
  @Type(() => Number) @IsInt() @Min(1) periodoAcademicoId!: number;
}
@ApiErroresOperacion() @ApiTags('academico') @ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('academico/materias/:materiaId/contextos')
export class MateriaContextosController {
  constructor(private readonly service: MateriaContextosService) {}
  @Get() @Roles('ADMINISTRATIVO', 'FINANZAS')
  listar(@Param('materiaId', ParseIntPipe) id: number, @Query() query: PaginacionDto, @CurrentUser() user: JwtUser) { return this.service.listar(id, query, user); }
  @Post() @Roles('ADMINISTRATIVO')
  vincular(@Param('materiaId', ParseIntPipe) id: number, @Body() dto: VincularMateriaPeriodoDto, @CurrentUser() user: JwtUser) { return this.service.vincular(id, dto.periodoAcademicoId, user); }
  @Delete(':id') @Roles('ADMINISTRATIVO')
  retirar(@Param('materiaId', ParseIntPipe) materiaId: number, @Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) { return this.service.retirar(materiaId, id, user); }
}
