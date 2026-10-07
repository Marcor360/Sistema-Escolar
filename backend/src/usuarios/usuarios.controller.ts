import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UsuariosService } from './usuarios.service';
import { ActualizarPersonalDto, ActualizarUsuarioDto, CrearUsuarioDto, ListadoUsuariosDto } from './usuarios.dto';
import { PaginacionDto } from '../common/paginacion.dto';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { CurrentUser, JwtUser } from '../common/current-user.decorator';

@ApiTags('usuarios')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPERADMIN')
@Controller('usuarios')
export class UsuariosController {
  constructor(private readonly service: UsuariosService) {}

  @Get() listar(@Query() query: PaginacionDto) { return this.service.listar(query); }
  @Get('listado')
  @Roles('ADMINISTRATIVO', 'FINANZAS', 'MAESTRO')
  listado(@Query() query: ListadoUsuariosDto, @CurrentUser() user: JwtUser) {
    return this.service.listado(query, user);
  }
  @Get(':id/personal') detallePersonal(@Param('id', ParseIntPipe) id: number) { return this.service.detallePersonal(id); }
  @Patch(':id/personal') actualizarPersonal(@Param('id', ParseIntPipe) id: number, @Body() dto: ActualizarPersonalDto, @CurrentUser() user: JwtUser) { return this.service.actualizarPersonal(id, dto, user); }
  @Get(':id') obtener(@Param('id', ParseIntPipe) id: number) { return this.service.obtener(id); }
  @Post() crear(@Body() dto: CrearUsuarioDto, @CurrentUser() user: JwtUser) { return this.service.crearPersonal(dto, user); }
  @Patch(':id') actualizar(@Param('id', ParseIntPipe) id: number, @Body() dto: ActualizarUsuarioDto) {
    return this.service.actualizar(id, dto);
  }
  @Delete(':id') desactivar(@Param('id', ParseIntPipe) id: number) { return this.service.desactivar(id); }
}
