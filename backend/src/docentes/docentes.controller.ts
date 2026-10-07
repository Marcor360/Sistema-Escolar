import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { DocentesService } from './docentes.service';
import { ActualizarDocenteDto, CrearDocenteDto, ListarDocentesDto, PlantelesDocenteDto, ReactivarDocenteDto } from './docentes.dto';
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

  @Get() listar(@CurrentUser() user: JwtUser, @Query() query: ListarDocentesDto) {
    return this.service.listar(user, query);
  }
  @Get(':id') obtener(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) {
    return this.service.obtenerParaApi(id, user);
  }
  @Post() crear(@Body() dto: CrearDocenteDto, @CurrentUser() user: JwtUser) { return this.service.crear(dto, user); }
  @Patch(':id') actualizar(
    @Param('id', ParseIntPipe) id: number, @Body() dto: ActualizarDocenteDto, @CurrentUser() user: JwtUser,
  ) {
    return this.service.actualizar(id, dto, user);
  }
  @Post(':id/planteles') planteles(@Param('id', ParseIntPipe) id: number, @Body() dto: PlantelesDocenteDto, @CurrentUser() user: JwtUser) {
    return this.service.asignarPlanteles(id, dto.plantelIds, user);
  }
  @Post(':id/baja') bajaExplicita(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) {
    return this.service.baja(id, user);
  }
  @Post(':id/reactivacion') reactivar(@Param('id', ParseIntPipe) id: number, @Body() dto: ReactivarDocenteDto, @CurrentUser() user: JwtUser) { return this.service.reactivar(id, dto.plantelIds, dto.motivo, user); }
  @Delete(':id') baja(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) {
    return this.service.baja(id, user);
  }
}
