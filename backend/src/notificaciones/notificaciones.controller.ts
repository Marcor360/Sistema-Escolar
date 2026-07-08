import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsArray, IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { NotificacionesService } from './notificaciones.service';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { CurrentUser, JwtUser } from '../common/current-user.decorator';

class DifundirDto {
  @IsString() @IsNotEmpty() titulo: string;
  @IsString() @IsNotEmpty() mensaje: string;
  @IsOptional() @IsArray() usuarioIds?: number[];
  @IsOptional() @IsIn(['ALUMNO', 'MAESTRO', 'ADMINISTRATIVO', 'FINANZAS']) rol?: string;
}

@ApiTags('notificaciones')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('notificaciones')
export class NotificacionesController {
  constructor(private readonly service: NotificacionesService) {}

  @Get('mias')
  mias(@CurrentUser() user: JwtUser) {
    return this.service.misNotificaciones(user.sub);
  }

  @Patch(':id/leer')
  leer(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) {
    return this.service.marcarLeida(id, user.sub);
  }

  @Post('difundir')
  @Roles('ADMINISTRATIVO')
  difundir(@Body() dto: DifundirDto) {
    return this.service.difundir(dto.titulo, dto.mensaje, {
      usuarioIds: dto.usuarioIds,
      rol: dto.rol,
    });
  }
}
