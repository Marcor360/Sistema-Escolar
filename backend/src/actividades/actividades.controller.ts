import {
  Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post,
  UploadedFile, UseGuards, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { ActividadesService } from './actividades.service';
import { ActualizarActividadDto, CalificarEntregaDto, CrearActividadDto, EntregarDto } from './actividades.dto';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { CurrentUser, JwtUser } from '../common/current-user.decorator';
import { uploadConfig } from '../common/upload.config';

@ApiTags('actividades')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class ActividadesController {
  constructor(private readonly service: ActividadesService) {}

  // ---- Alumno ----
  @Get('alumnos/me/tareas')
  @Roles('ALUMNO')
  misTareas(@CurrentUser() user: JwtUser) {
    return this.service.misTareas(user);
  }

  @Post('actividades/:id/entrega')
  @Roles('ALUMNO')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('archivo', uploadConfig))
  entregar(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: JwtUser,
    @Body() dto: EntregarDto,
    @UploadedFile() archivo?: Express.Multer.File,
  ) {
    return this.service.entregar(id, user, dto, archivo);
  }

  // ---- Docente / administrativo ----
  @Get('grupo-materias/:id/actividades')
  @Roles('MAESTRO', 'ADMINISTRATIVO', 'ALUMNO')
  listar(@Param('id', ParseIntPipe) id: number) {
    return this.service.listarPorGrupoMateria(id);
  }

  @Post('actividades')
  @Roles('MAESTRO', 'ADMINISTRATIVO')
  crear(@Body() dto: CrearActividadDto, @CurrentUser() user: JwtUser) {
    return this.service.crear(dto, user);
  }

  @Patch('actividades/:id')
  @Roles('MAESTRO', 'ADMINISTRATIVO')
  actualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarActividadDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.service.actualizar(id, dto, user);
  }

  @Delete('actividades/:id')
  @Roles('MAESTRO', 'ADMINISTRATIVO')
  desactivar(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) {
    return this.service.desactivar(id, user);
  }

  @Get('actividades/:id/entregas')
  @Roles('MAESTRO', 'ADMINISTRATIVO')
  entregas(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) {
    return this.service.entregasDeActividad(id, user);
  }

  @Patch('entregas/:id/calificar')
  @Roles('MAESTRO', 'ADMINISTRATIVO')
  calificar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CalificarEntregaDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.service.calificarEntrega(id, dto, user);
  }

  // ---- Materiales ----
  @Get('grupo-materias/:id/materiales')
  @Roles('MAESTRO', 'ADMINISTRATIVO', 'ALUMNO')
  materiales(@Param('id', ParseIntPipe) id: number) {
    return this.service.materialesDeGrupoMateria(id);
  }

  @Post('grupo-materias/:id/materiales')
  @Roles('MAESTRO', 'ADMINISTRATIVO')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('archivo', uploadConfig))
  subirMaterial(
    @Param('id', ParseIntPipe) id: number,
    @Body('titulo') titulo: string,
    @UploadedFile() archivo: Express.Multer.File,
    @CurrentUser() user: JwtUser,
  ) {
    return this.service.subirMaterial(id, titulo, archivo, user);
  }
}
