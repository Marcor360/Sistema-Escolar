import { Controller, Get, Param, ParseIntPipe, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ArchivosService } from './archivos.service';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { CurrentUser, JwtUser } from '../common/current-user.decorator';

@ApiTags('archivos')
@Controller('archivos')
export class ArchivosController {
  constructor(private readonly service: ArchivosService) {}

  @Get('materiales/:id/enlace')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  enlaceMaterial(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) {
    return this.service.enlaceMaterial(id, user);
  }

  @Get('entregas/:id/enlace')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  enlaceEntrega(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) {
    return this.service.enlaceEntrega(id, user);
  }

  // Sin guard de clase: estos dos abren archivos con <a>/Linking.openURL (sin encabezado
  // Authorization); la autorización viaja y se revalida con el token firmado `t`.
  @Get('materiales/:id')
  descargarMaterial(@Param('id', ParseIntPipe) id: number, @Query('t') token: string, @Res() res: Response) {
    return this.service.descargarMaterial(id, token, res);
  }

  @Get('entregas/:id')
  descargarEntrega(@Param('id', ParseIntPipe) id: number, @Query('t') token: string, @Res() res: Response) {
    return this.service.descargarEntrega(id, token, res);
  }
}
