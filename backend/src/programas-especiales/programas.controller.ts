import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, JwtUser } from '../common/current-user.decorator';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { PaginacionDto } from '../common/paginacion.dto';
import { AsignaturaEspecialDto, CrearGrupoEspecialDto, CrearProgramaDto, EditarGrupoEspecialDto, EditarProgramaDto, InscribirEspecialDto, ListarProgramasDto, TransicionEspecialDto } from './programas.dto';
import { ProgramasEspecialesService } from './programas.service';
@ApiTags('programas-especiales') @ApiBearerAuth() @UseGuards(JwtAuthGuard, RolesGuard) @Roles('ADMINISTRATIVO')
@Controller('programas-especiales')
export class ProgramasEspecialesController {
  constructor(private readonly service: ProgramasEspecialesService) {}
  @Get('me') @Roles('ALUMNO') propios(@Query() q: PaginacionDto, @CurrentUser() u: JwtUser) { return this.service.propios(q, u); }
  @Get() listar(@Query() q: ListarProgramasDto, @CurrentUser() u: JwtUser) { return this.service.listar(q, u); }
  @Post() crear(@Body() d: CrearProgramaDto, @CurrentUser() u: JwtUser) { return this.service.crear(d, u); }
  @Get(':id') obtener(@Param('id', ParseIntPipe) id: number, @CurrentUser() u: JwtUser) { return this.service.obtener(id, u); }
  @Patch(':id') editar(@Param('id', ParseIntPipe) id: number, @Body() d: EditarProgramaDto, @CurrentUser() u: JwtUser) { return this.service.editar(id, d, u); }
  @Post(':id/cerrar') cerrar(@Param('id', ParseIntPipe) id: number, @Body() d: TransicionEspecialDto, @CurrentUser() u: JwtUser) { return this.service.terminar(id, 'CERRADO', d, u); }
  @Post(':id/cancelar') cancelar(@Param('id', ParseIntPipe) id: number, @Body() d: TransicionEspecialDto, @CurrentUser() u: JwtUser) { return this.service.terminar(id, 'CANCELADO', d, u); }
  @Get(':id/grupos') grupos(@Param('id', ParseIntPipe) id: number, @Query() q: PaginacionDto, @CurrentUser() u: JwtUser) { return this.service.grupos(id, q, u); }
  @Post(':id/grupos') crearGrupo(@Param('id', ParseIntPipe) id: number, @Body() d: CrearGrupoEspecialDto, @CurrentUser() u: JwtUser) { return this.service.crearGrupo(id, d, u); }
  @Get('grupos/:id') grupo(@Param('id', ParseIntPipe) id: number, @CurrentUser() u: JwtUser) { return this.service.grupo(id, u); }
  @Patch('grupos/:id/asignaturas/:claseId') reasignar(@Param('id', ParseIntPipe) id: number, @Param('claseId', ParseIntPipe) claseId: number, @Body() d: AsignaturaEspecialDto, @CurrentUser() u: JwtUser) { return this.service.agregarAsignatura(id, d, u, claseId); }
  @Get('grupos/:id/asignaturas') clases(@Param('id', ParseIntPipe) id: number, @CurrentUser() u: JwtUser) { return this.service.clases(id, u); }
  @Post('grupos/:id/asignaturas') asignatura(@Param('id', ParseIntPipe) id: number, @Body() d: AsignaturaEspecialDto, @CurrentUser() u: JwtUser) { return this.service.agregarAsignatura(id, d, u); }
  @Get('grupos/:id/inscripciones') inscritos(@Param('id', ParseIntPipe) id: number, @Query() q: PaginacionDto, @CurrentUser() u: JwtUser) { return this.service.inscritos(id, q, u); }
  @Post('grupos/:id/inscripciones') inscribir(@Param('id', ParseIntPipe) id: number, @Body() d: InscribirEspecialDto, @CurrentUser() u: JwtUser) { return this.service.inscribir(id, d.alumnoId, u); }
  @Post('grupos/:id/inscripciones/:inscripcionId/baja') baja(@Param('id', ParseIntPipe) id: number, @Param('inscripcionId', ParseIntPipe) inscripcionId: number, @Body() d: TransicionEspecialDto, @CurrentUser() u: JwtUser) { return this.service.baja(id, inscripcionId, d, u); }
  @Patch('grupos/:id') cupo(@Param('id', ParseIntPipe) id: number, @Body() d: EditarGrupoEspecialDto, @CurrentUser() u: JwtUser) { return this.service.editarGrupo(id, d, u); }
}
