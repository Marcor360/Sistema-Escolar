import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ActivacionService } from '../auth/activacion.service';
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
  constructor(private readonly service: DocentesService, private readonly activacion: ActivacionService) {}

  @Get() listar(@CurrentUser() user: JwtUser, @Query() query: ListarDocentesDto) {
    return this.service.listar(user, query);
  }
  @Get(':id') obtener(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) {
    return this.service.obtenerParaApi(id, user);
  }
  @Post()
  @ApiOperation({ summary: 'Registrar docente e invitarlo a activar su cuenta' })
  async crear(@Body() dto: CrearDocenteDto, @CurrentUser() user: JwtUser) {
    const docente = await this.service.crear(dto, user);
    await this.activacion.solicitar(dto.email);
    return docente;
  }
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
