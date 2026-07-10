import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AcademicoService } from './academico.service';
import { AsignarMateriaDto, CicloDto, GrupoDto, InscribirAlumnoDto, MateriaDto } from './academico.dto';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { CurrentUser, JwtUser } from '../common/current-user.decorator';

@ApiTags('academico')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('academico')
export class AcademicoController {
  constructor(private readonly service: AcademicoService) {}

  // ---- Panel maestro ----
  @Get('mis-grupos')
  @Roles('MAESTRO')
  misGrupos(@CurrentUser() user: JwtUser) {
    return this.service.misGrupos(user.sub);
  }

  // ---- Ciclos ----
  @Get('ciclos') listarCiclos() { return this.service.listarCiclos(); }
  @Post('ciclos') @Roles('ADMINISTRATIVO') crearCiclo(@Body() dto: CicloDto) {
    return this.service.crearCiclo(dto);
  }
  @Patch('ciclos/:id') @Roles('ADMINISTRATIVO')
  actualizarCiclo(@Param('id', ParseIntPipe) id: number, @Body() dto: Partial<CicloDto>) {
    return this.service.actualizarCiclo(id, dto);
  }

  // ---- Materias ----
  @Get('materias') listarMaterias() { return this.service.listarMaterias(); }
  @Post('materias') @Roles('ADMINISTRATIVO') crearMateria(@Body() dto: MateriaDto) {
    return this.service.crearMateria(dto);
  }
  @Patch('materias/:id') @Roles('ADMINISTRATIVO')
  actualizarMateria(@Param('id', ParseIntPipe) id: number, @Body() dto: Partial<MateriaDto>) {
    return this.service.actualizarMateria(id, dto);
  }
  @Delete('materias/:id') @Roles('ADMINISTRATIVO')
  desactivarMateria(@Param('id', ParseIntPipe) id: number) {
    return this.service.desactivarMateria(id);
  }

  // ---- Grupos ----
  @Get('grupos') @Roles('ADMINISTRATIVO', 'MAESTRO', 'FINANZAS')
  listarGrupos(@CurrentUser() user: JwtUser, @Query('cicloId') cicloId?: string, @Query('plantelId') plantelId?: string) {
    return this.service.listarGrupos(user, cicloId ? Number(cicloId) : undefined, plantelId ? Number(plantelId) : undefined);
  }
  @Post('grupos') @Roles('ADMINISTRATIVO') crearGrupo(@Body() dto: GrupoDto, @CurrentUser() user: JwtUser) {
    return this.service.crearGrupo(dto, user);
  }
  @Get('grupo-materias') @Roles('ADMINISTRATIVO', 'FINANZAS')
  listarGrupoMaterias() {
    return this.service.listarGrupoMaterias();
  }
  @Get('grupos/:id/materias') @Roles('ADMINISTRATIVO', 'MAESTRO')
  materiasDeGrupo(@Param('id', ParseIntPipe) id: number) {
    return this.service.materiasDeGrupo(id);
  }
  @Post('grupos/:id/materias') @Roles('ADMINISTRATIVO')
  asignarMateria(@Param('id', ParseIntPipe) id: number, @Body() dto: AsignarMateriaDto) {
    return this.service.asignarMateria(id, dto);
  }
  @Patch('grupo-materias/:id/docente/:docenteId') @Roles('ADMINISTRATIVO')
  asignarDocente(
    @Param('id', ParseIntPipe) id: number,
    @Param('docenteId', ParseIntPipe) docenteId: number,
  ) {
    return this.service.asignarDocente(id, docenteId);
  }

  // ---- Inscripciones ----
  @Get('grupos/:id/alumnos') @Roles('ADMINISTRATIVO', 'MAESTRO')
  alumnosDeGrupo(@Param('id', ParseIntPipe) id: number) {
    return this.service.alumnosDeGrupo(id);
  }
  @Post('grupos/:id/alumnos') @Roles('ADMINISTRATIVO')
  inscribir(@Param('id', ParseIntPipe) id: number, @Body() dto: InscribirAlumnoDto, @CurrentUser() user: JwtUser) {
    return this.service.inscribirAlumno(id, dto.alumnoId, user);
  }
  @Delete('inscripciones/:id') @Roles('ADMINISTRATIVO')
  bajaInscripcion(@Param('id', ParseIntPipe) id: number) {
    return this.service.bajaInscripcion(id);
  }
}
