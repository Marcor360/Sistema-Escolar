import { ApiErroresOperacion } from '../common/api-operacion';
import { PreviewPromocionRespuestaDto, ConfirmacionPromocionRespuestaDto, CicloRespuestaDto, ResumenCierreRespuestaDto } from './respuestas.dto';
import { PromocionService } from './promocion.service';
import { PromocionDto, ConfirmarPromocionDto } from './promocion.dto';
import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiCreatedResponse, ApiOkResponse } from '@nestjs/swagger';
import { CiclosService } from './ciclos.service';
import { TransicionCicloDto } from './academico.dto';
import { AcademicoService } from './academico.service';
import {
  ActualizarCicloDto, ActualizarGrupoDto, ActualizarMateriaDto, AsignarMateriaDto, CicloDto, GrupoDto, InscribirAlumnoDto, ListarGruposDto, MateriaDto,
} from './academico.dto';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { CurrentUser, JwtUser } from '../common/current-user.decorator';

@ApiErroresOperacion() @ApiTags('academico')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('academico')
export class AcademicoController {
  constructor(private readonly promocion: PromocionService, private readonly service: AcademicoService, private readonly ciclos: CiclosService) {}

  // ---- Panel maestro ----
  @Get('bitacora') @Roles('ADMINISTRATIVO') bitacora(@CurrentUser() user: JwtUser, @Query() query: ListarGruposDto) { return this.service.bitacoraAcademica(user, query); }
  @ApiOperation({ summary: 'Alumnos elegibles entre ciclo cerrado y preparación del mismo plantel' })
  @ApiCreatedResponse({ type: PreviewPromocionRespuestaDto })
  @Post('promocion/preview') @Roles('ADMINISTRATIVO') previewPromocion(@Body() dto: PromocionDto, @CurrentUser() user: JwtUser) { return this.promocion.preview(dto, user); }
  @ApiOperation({ summary: 'Promoción seleccionada y atómica con bloqueo; conserva notas del origen' })
  @ApiCreatedResponse({ type: ConfirmacionPromocionRespuestaDto })
  @Post('promocion/confirmar') @Roles('ADMINISTRATIVO') confirmarPromocion(@Body() dto: ConfirmarPromocionDto, @CurrentUser() user: JwtUser) { return this.promocion.confirmar(dto, user); }

  @Get('mis-grupos')
  @Roles('MAESTRO')
  misGrupos(@CurrentUser() user: JwtUser) {
    return this.service.misGrupos(user.sub);
  }

  // ---- Ciclos ----
  @Get('ciclos') @Roles('ADMINISTRATIVO', 'FINANZAS', 'MAESTRO')
  listarCiclos() { return this.service.listarCiclos(); }
  @Post('ciclos') @Roles('ADMINISTRATIVO') crearCiclo(@Body() dto: CicloDto) {
    return this.service.crearCiclo(dto);
  }
  @Patch('ciclos/:id') @Roles('ADMINISTRATIVO')
  actualizarCiclo(@Param('id', ParseIntPipe) id: number, @Body() dto: ActualizarCicloDto) {
    return this.service.actualizarCiclo(id, dto);
  }

  @ApiOperation({ summary: 'Resumen previo al cierre, sin mezclar ciclos; reservado a Superadmin' })
  @ApiOkResponse({ type: ResumenCierreRespuestaDto })
  @Get('ciclos/:id/cierre') @Roles('SUPERADMIN')
  resumenCierre(@Param('id', ParseIntPipe) id: number) { return this.ciclos.resumen(id); }
  @ApiOperation({ summary: 'Activar ciclo preparado; rechaza otro ciclo vigente' })
  @ApiCreatedResponse({ type: CicloRespuestaDto })
  @Post('ciclos/:id/activar') @Roles('SUPERADMIN')
  activar(@Param('id', ParseIntPipe) id: number, @Body() dto: TransicionCicloDto, @CurrentUser() user: JwtUser) { return this.ciclos.transicion(id, 'activar', dto.confirmado, user); }
  @ApiOperation({ summary: 'Iniciar cierre del ciclo vigente sin grupos inscritos sin materias' })
  @ApiCreatedResponse({ type: CicloRespuestaDto })
  @Post('ciclos/:id/iniciar-cierre') @Roles('SUPERADMIN')
  iniciarCierre(@Param('id', ParseIntPipe) id: number, @Body() dto: TransicionCicloDto, @CurrentUser() user: JwtUser) { return this.ciclos.transicion(id, 'iniciar-cierre', dto.confirmado, user); }
  @ApiOperation({ summary: 'Cerrar ciclo solo con P1-P3 completos y periodos cerrados' })
  @ApiCreatedResponse({ type: CicloRespuestaDto })
  @Post('ciclos/:id/cerrar') @Roles('SUPERADMIN')
  cerrar(@Param('id', ParseIntPipe) id: number, @Body() dto: TransicionCicloDto, @CurrentUser() user: JwtUser) { return this.ciclos.transicion(id, 'cerrar', dto.confirmado, user); }

  // ---- Materias ----
  @Get('materias') @Roles('ADMINISTRATIVO', 'FINANZAS', 'MAESTRO')
  listarMaterias() { return this.service.listarMaterias(); }
  @Post('materias') @Roles('ADMINISTRATIVO') crearMateria(@Body() dto: MateriaDto) {
    return this.service.crearMateria(dto);
  }
  @Patch('materias/:id') @Roles('ADMINISTRATIVO')
  actualizarMateria(@Param('id', ParseIntPipe) id: number, @Body() dto: ActualizarMateriaDto) {
    return this.service.actualizarMateria(id, dto);
  }
  @Delete('materias/:id') @Roles('ADMINISTRATIVO')
  desactivarMateria(@Param('id', ParseIntPipe) id: number) {
    return this.service.desactivarMateria(id);
  }

  // ---- Grupos ----
  @Get('grupos') @Roles('ADMINISTRATIVO', 'MAESTRO', 'FINANZAS')
  listarGrupos(@CurrentUser() user: JwtUser, @Query() query: ListarGruposDto) {
    return this.service.listarGrupos(user, query);
  }
  @Post('grupos') @Roles('ADMINISTRATIVO') crearGrupo(@Body() dto: GrupoDto, @CurrentUser() user: JwtUser) {
    return this.service.crearGrupo(dto, user);
  }
  @Patch('grupos/:id') @Roles('ADMINISTRATIVO')
  actualizarGrupo(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarGrupoDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.service.actualizarGrupo(id, dto, user);
  }
  @Delete('grupos/:id') @Roles('ADMINISTRATIVO')
  eliminarGrupo(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) {
    return this.service.eliminarGrupo(id, user);
  }
  @ApiOperation({ summary: 'Clases vigentes paginadas para captura, por plantel y clases propias del maestro' })
  @Get('clases-seleccion') @Roles('ADMINISTRATIVO','MAESTRO')
  clasesParaSeleccion(@CurrentUser() user: JwtUser, @Query() query: ListarGruposDto) { return this.service.clasesParaSeleccion(user,query); }

  @Get('grupo-materias') @Roles('ADMINISTRATIVO', 'FINANZAS')
  listarGrupoMaterias(@CurrentUser() user: JwtUser) {
    return this.service.listarGrupoMaterias(user);
  }
  @Get('grupos/:id/materias') @Roles('ADMINISTRATIVO', 'MAESTRO')
  materiasDeGrupo(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) {
    return this.service.materiasDeGrupo(id, user);
  }
  @Post('grupos/:id/materias') @Roles('ADMINISTRATIVO')
  asignarMateria(
    @Param('id', ParseIntPipe) id: number, @Body() dto: AsignarMateriaDto, @CurrentUser() user: JwtUser,
  ) {
    return this.service.asignarMateria(id, dto, user);
  }
  @Patch('grupo-materias/:id/docente/:docenteId') @Roles('ADMINISTRATIVO')
  asignarDocente(
    @Param('id', ParseIntPipe) id: number,
    @Param('docenteId', ParseIntPipe) docenteId: number,
    @CurrentUser() user: JwtUser,
  ) {
    return this.service.asignarDocente(id, docenteId, user);
  }
  @Delete('grupo-materias/:id') @Roles('ADMINISTRATIVO')
  eliminarGrupoMateria(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) {
    return this.service.eliminarGrupoMateria(id, user);
  }

  // ---- Inscripciones ----
  @Get('grupos/:id/alumnos') @Roles('ADMINISTRATIVO', 'MAESTRO')
  alumnosDeGrupo(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) {
    return this.service.alumnosDeGrupo(id, user);
  }
  @Post('grupos/:id/alumnos') @Roles('ADMINISTRATIVO')
  inscribir(@Param('id', ParseIntPipe) id: number, @Body() dto: InscribirAlumnoDto, @CurrentUser() user: JwtUser) {
    return this.service.inscribirAlumno(id, dto.alumnoId, user);
  }
  @Delete('inscripciones/:id') @Roles('ADMINISTRATIVO')
  bajaInscripcion(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) {
    return this.service.bajaInscripcion(id, user);
  }
}
