import { PaginacionDto } from '../common/paginacion.dto';
import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AlumnosService } from './alumnos.service';
import { ActivacionService } from '../auth/activacion.service';
import { ActualizarAlumnoDto, CrearAlumnoDto, ListarAlumnosDto, TransferirAlumnoDto, ReactivarAlumnoDto } from './alumnos.dto';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { CurrentUser, JwtUser } from '../common/current-user.decorator';

@ApiTags('alumnos')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('alumnos')
export class AlumnosController {
  constructor(private readonly service: AlumnosService, private readonly activacion: ActivacionService) {}

  // --- Portal/app del alumno ---
  @Get('me/materias/listado') @Roles('ALUMNO')
  consultarMisMaterias(@Query() q:PaginacionDto,@CurrentUser() user:JwtUser) {return this.service.consultarMisMaterias(user.sub,q);}

  @Get('me/materias')
  @Roles('ALUMNO')
  misMaterias(@CurrentUser() user: JwtUser) {
    return this.service.misMaterias(user.sub);
  }

  @Get('me/perfil')
  @Roles('ALUMNO')
  miPerfil(@CurrentUser() user: JwtUser) {
    return this.service.perfilPropio(user.sub);
  }

  // --- Control escolar ---
  @Get()
  @Roles('ADMINISTRATIVO', 'FINANZAS', 'MAESTRO')
  listar(@CurrentUser() user: JwtUser, @Query() query: ListarAlumnosDto) {
    return this.service.listar(query, user);
  }

  @ApiOperation({ summary: 'Historial académico paginado del alumno dentro del alcance de Control Escolar' })
  @Get(':id/historial/listado') @Roles('ADMINISTRATIVO')
  historialPaginado(@Param('id', ParseIntPipe) id: number, @Query() query: PaginacionDto, @CurrentUser() user: JwtUser) {
    return this.service.historialPaginado(id, user, query);
  }

  @Get(':id/historial')
  @Roles('ADMINISTRATIVO')
  historial(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) {
    return this.service.historial(id, user);
  }

  @Get(':id')
  @Roles('ADMINISTRATIVO', 'FINANZAS', 'MAESTRO')
  obtener(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) {
    return this.service.obtenerParaApi(id, user);
  }

  @ApiOperation({ summary: 'Registrar alumno con CURP obligatoria; cuenta pendiente de activación por código privado y contraseña elegida por el titular' })
  @ApiResponse({ status: 400, description: 'Campos obligatorios o CURP inválidos' })
  @ApiResponse({ status: 409, description: 'Correo o matrícula ya registrados' })
  @Post()
  @Roles('FINANZAS')
  async crear(@Body() dto: CrearAlumnoDto, @CurrentUser() user: JwtUser) {
    const alumno = await this.service.crear(dto, user);
    // Encolar solo después del commit: la cuenta no debe recibir invitación si el alta falló.
    await this.activacion.solicitar(dto.email);
    return alumno;
  }

  @ApiOperation({ summary: 'Corregir datos de alumno; estatus y plantel requieren acciones explícitas' })
  @ApiResponse({ status: 400, description: 'Datos o transición inválidos' })
  @ApiResponse({ status: 401, description: 'Sesión expirada o revocada' })
  @ApiResponse({ status: 403, description: 'Rol, portal, alcance u origen no autorizado' })
  @ApiResponse({ status: 409, description: 'Conflicto con el estado actual' })
  @Patch(':id')
  @Roles('ADMINISTRATIVO')
  actualizar(@Param('id', ParseIntPipe) id: number, @Body() dto: ActualizarAlumnoDto, @CurrentUser() user: JwtUser) {
    return this.service.actualizar(id, dto, user);
  }

  @ApiOperation({ summary: 'Transferir entre planteles autorizados y terminar inscripciones anteriores' })
  @ApiResponse({ status: 400, description: 'Datos o transición inválidos' })
  @ApiResponse({ status: 401, description: 'Sesión expirada o revocada' })
  @ApiResponse({ status: 403, description: 'Rol, portal, alcance u origen no autorizado' })
  @ApiResponse({ status: 409, description: 'Conflicto con el estado actual' })
  @Post(':id/transferencia')
  @Roles('ADMINISTRATIVO')
  transferir(@Param('id', ParseIntPipe) id: number, @Body() dto: TransferirAlumnoDto, @CurrentUser() user: JwtUser) {
    return this.service.transferir(id, dto.plantelId, user);
  }

  @ApiOperation({ summary: 'Egresar y revocar acceso conservando expediente' })
  @ApiResponse({ status: 400, description: 'Datos o transición inválidos' })
  @ApiResponse({ status: 401, description: 'Sesión expirada o revocada' })
  @ApiResponse({ status: 403, description: 'Rol, portal, alcance u origen no autorizado' })
  @ApiResponse({ status: 409, description: 'Conflicto con el estado actual' })
  @Post(':id/egreso')
  @Roles('ADMINISTRATIVO')
  egresar(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) {
    return this.service.egresar(id, user);
  }

  @ApiOperation({ summary: 'Dar de baja alumno, cuenta e inscripciones en una transacción' })
  @ApiResponse({ status: 400, description: 'Datos o transición inválidos' })
  @ApiResponse({ status: 401, description: 'Sesión expirada o revocada' })
  @ApiResponse({ status: 403, description: 'Rol, portal, alcance u origen no autorizado' })
  @ApiResponse({ status: 409, description: 'Conflicto con el estado actual' })
  @Post(':id/baja')
  @Roles('ADMINISTRATIVO')
  bajaExplicita(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) {
    return this.service.baja(id, user);
  }

  @Post(':id/reactivacion') @Roles('ADMINISTRATIVO')
  reactivar(@Param('id', ParseIntPipe) id: number, @Body() dto: ReactivarAlumnoDto, @CurrentUser() user: JwtUser) { return this.service.reactivar(id, dto.motivo, user); }

  @Delete(':id')
  @Roles('ADMINISTRATIVO')
  baja(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) {
    return this.service.baja(id, user);
  }
}
