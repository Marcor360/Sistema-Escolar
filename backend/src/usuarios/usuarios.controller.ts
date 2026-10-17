import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { UsuariosService } from './usuarios.service';
import { ActivacionService } from '../auth/activacion.service';
import { ActualizarPersonalDto, ActualizarUsuarioDto, CrearPersonalDto, ListadoUsuariosDto, RestablecerPasswordAdministrativoDto } from './usuarios.dto';
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
  constructor(private readonly service: UsuariosService, private readonly activacion: ActivacionService) {}

  @Get() listar(@Query() query: PaginacionDto) { return this.service.listar(query); }
  @Get('listado')
  @Roles('ADMINISTRATIVO', 'FINANZAS', 'MAESTRO')
  listado(@Query() query: ListadoUsuariosDto, @CurrentUser() user: JwtUser) {
    return this.service.listado(query, user);
  }
  @Post(':id/restablecer-password')
  @Roles('ADMINISTRATIVO')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Restablecer contraseña con alcance de plantel, sin contraseña anterior; revoca todas las sesiones' })
  restablecerPassword(@Param('id', ParseIntPipe) id: number, @Body() dto: RestablecerPasswordAdministrativoDto, @CurrentUser() user: JwtUser) {
    return this.service.restablecerPasswordAdministrativo(id, dto.nueva, user);
  }

  @Get(':id/personal') detallePersonal(@Param('id', ParseIntPipe) id: number) { return this.service.detallePersonal(id); }
  @Patch(':id/personal') actualizarPersonal(@Param('id', ParseIntPipe) id: number, @Body() dto: ActualizarPersonalDto, @CurrentUser() user: JwtUser) { return this.service.actualizarPersonal(id, dto, user); }
  @Get(':id') obtener(@Param('id', ParseIntPipe) id: number) { return this.service.obtener(id); }
  @Post()
  @ApiOperation({ summary: 'Crear personal con cuenta pendiente de activación e invitar después de confirmar el alta' })
  async crear(@Body() dto: CrearPersonalDto, @CurrentUser() user: JwtUser) {
    const cuenta = await this.service.crearPersonal(dto, user);
    await this.activacion.solicitar(cuenta.email);
    return cuenta;
  }
  @Patch(':id') actualizar(@Param('id', ParseIntPipe) id: number, @Body() dto: ActualizarUsuarioDto) {
    return this.service.actualizar(id, dto);
  }
  @Delete(':id') desactivar(@Param('id', ParseIntPipe) id: number) { return this.service.desactivar(id); }
}
