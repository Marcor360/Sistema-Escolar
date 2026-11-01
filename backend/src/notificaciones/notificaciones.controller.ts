import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { DifundirDto } from './notificaciones.dto';
import { PaginacionDto } from '../common/paginacion.dto';
import { ComunicadosAlumnosService } from './comunicados-alumnos.service';
import { CrearComunicadoDto, EditarComunicadoDto } from './comunicados-alumnos.dto';
import { NotificacionesService } from './notificaciones.service';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { CurrentUser, JwtUser } from '../common/current-user.decorator';

@ApiTags('notificaciones')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('notificaciones')
export class NotificacionesController {
  constructor(private readonly service: NotificacionesService, private readonly comunicados: ComunicadosAlumnosService) {}

  @Get('mias')
  mias(@CurrentUser() user: JwtUser) {
    return this.service.misNotificaciones(user.sub);
  }

  @Get('comunicados')
  @Roles('ADMINISTRATIVO')
  @ApiOperation({ summary: 'Listar borradores y envíos de comunicados a alumnos por plantel autorizado' })
  listarComunicados(@Query() query: PaginacionDto, @CurrentUser() actor: JwtUser) {
    return this.comunicados.listar(query, actor);
  }

  @Post('comunicados')
  @Roles('ADMINISTRATIVO')
  @ApiOperation({ summary: 'Crear borrador de comunicado del plantel sin enviarlo' })
  crearComunicado(@Body() dto: CrearComunicadoDto, @CurrentUser() actor: JwtUser) {
    return this.comunicados.crear(dto, actor);
  }

  @Patch('comunicados/:id')
  @Roles('ADMINISTRATIVO')
  @ApiOperation({ summary: 'Editar solo borradores, sin modificar avisos ya enviados' })
  editarComunicado(@Param('id', ParseIntPipe) id: number, @Body() dto: EditarComunicadoDto, @CurrentUser() actor: JwtUser) {
    return this.comunicados.editar(id, dto, actor);
  }

  @Post('comunicados/:id/preview')
  @Roles('ADMINISTRATIVO')
  @ApiOperation({ summary: 'Contar alumnos destinatarios activos antes de la publicación' })
  previewComunicado(@Param('id', ParseIntPipe) id: number, @CurrentUser() actor: JwtUser) {
    return this.comunicados.vistaPrevia(id, actor);
  }

  @Post('comunicados/:id/publicar')
  @Roles('ADMINISTRATIVO')
  @ApiOperation({ summary: 'Publicar comunicado de modo atómico e idempotente en la bandeja del alumno' })
  publicarComunicado(@Param('id', ParseIntPipe) id: number, @CurrentUser() actor: JwtUser) {
    return this.comunicados.publicar(id, actor);
  }

  @Patch(':id/leer')
  leer(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) {
    return this.service.marcarLeida(id, user.sub);
  }

  @Post('difundir')
  @Roles('ADMINISTRATIVO')
  difundir(@Body() dto: DifundirDto, @CurrentUser() user: JwtUser) {
    return this.service.difundir(dto.titulo, dto.mensaje, {
      usuarioIds: dto.usuarioIds,
      rol: dto.rol,
    }, user);
  }
}
