import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AlumnosService } from './alumnos.service';
import { ActualizarAlumnoDto, CrearAlumnoDto, ListarAlumnosDto } from './alumnos.dto';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { CurrentUser, JwtUser } from '../common/current-user.decorator';

@ApiTags('alumnos')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('alumnos')
export class AlumnosController {
  constructor(private readonly service: AlumnosService) {}

  // --- Portal/app del alumno ---
  @Get('me/materias')
  @Roles('ALUMNO')
  misMaterias(@CurrentUser() user: JwtUser) {
    return this.service.misMaterias(user.sub);
  }

  @Get('me/perfil')
  @Roles('ALUMNO')
  miPerfil(@CurrentUser() user: JwtUser) {
    return this.service.obtenerPorUsuario(user.sub);
  }

  // --- Control escolar ---
  @Get()
  @Roles('ADMINISTRATIVO', 'FINANZAS', 'MAESTRO')
  listar(@CurrentUser() user: JwtUser, @Query() query: ListarAlumnosDto) {
    return this.service.listar(query, user);
  }

  @Get(':id')
  @Roles('ADMINISTRATIVO', 'FINANZAS', 'MAESTRO')
  obtener(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) {
    return this.service.obtener(id, user);
  }

  @Post()
  @Roles('ADMINISTRATIVO')
  crear(@Body() dto: CrearAlumnoDto, @CurrentUser() user: JwtUser) {
    return this.service.crear(dto, user);
  }

  @Patch(':id')
  @Roles('ADMINISTRATIVO')
  actualizar(@Param('id', ParseIntPipe) id: number, @Body() dto: ActualizarAlumnoDto, @CurrentUser() user: JwtUser) {
    return this.service.actualizar(id, dto, user);
  }

  @Delete(':id')
  @Roles('ADMINISTRATIVO')
  baja(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) {
    return this.service.baja(id, user);
  }
}
