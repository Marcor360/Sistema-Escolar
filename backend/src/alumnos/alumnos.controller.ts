import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AlumnosService } from './alumnos.service';
import { ActualizarAlumnoDto, CrearAlumnoDto } from './alumnos.dto';
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
  listar(@Query('buscar') buscar?: string) {
    return this.service.listar(buscar);
  }

  @Get(':id')
  @Roles('ADMINISTRATIVO', 'FINANZAS', 'MAESTRO')
  obtener(@Param('id', ParseIntPipe) id: number) {
    return this.service.obtener(id);
  }

  @Post()
  @Roles('ADMINISTRATIVO')
  crear(@Body() dto: CrearAlumnoDto) {
    return this.service.crear(dto);
  }

  @Patch(':id')
  @Roles('ADMINISTRATIVO')
  actualizar(@Param('id', ParseIntPipe) id: number, @Body() dto: ActualizarAlumnoDto) {
    return this.service.actualizar(id, dto);
  }

  @Delete(':id')
  @Roles('ADMINISTRATIVO')
  baja(@Param('id', ParseIntPipe) id: number) {
    return this.service.baja(id);
  }
}
