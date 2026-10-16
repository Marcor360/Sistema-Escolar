import { Body, Controller, Delete, Param, ParseIntPipe, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Equals } from 'class-validator';
import { CurrentUser, JwtUser } from '../common/current-user.decorator';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { EliminacionService } from './eliminacion.service';

class ConfirmarEliminacionDto {
  @Equals('ELIMINAR', { message: 'Confirma la eliminación definitiva con ELIMINAR' }) confirmacion!: string;
}

@ApiTags('eliminacion')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPERADMIN')
@Controller()
export class EliminacionController {
  constructor(private readonly service: EliminacionService) {}

  @Delete('alumnos/:id/permanente')
  @ApiOperation({ summary: 'Eliminar expediente y cuenta de alumno sin registros vinculados' })
  alumno(@Param('id', ParseIntPipe) id: number, @Body() _dto: ConfirmarEliminacionDto, @CurrentUser() user: JwtUser) {
    return this.service.eliminar('alumnos', id, user);
  }
  @Delete('docentes/:id/permanente')
  docente(@Param('id', ParseIntPipe) id: number, @Body() _dto: ConfirmarEliminacionDto, @CurrentUser() user: JwtUser) {
    return this.service.eliminar('docentes', id, user);
  }
  @Delete('planteles/:id/permanente')
  plantel(@Param('id', ParseIntPipe) id: number, @Body() _dto: ConfirmarEliminacionDto, @CurrentUser() user: JwtUser) {
    return this.service.eliminar('planteles', id, user);
  }
  @Delete('usuarios/:id/permanente')
  usuario(@Param('id', ParseIntPipe) id: number, @Body() _dto: ConfirmarEliminacionDto, @CurrentUser() user: JwtUser) {
    return this.service.eliminar('usuarios', id, user);
  }
}
