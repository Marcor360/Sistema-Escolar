import { Response } from 'express';
import { contentDisposition } from '../common/content-disposition';
import { Body, Controller, Get, Header, Param, ParseIntPipe, Post, Query, Res, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { CurrentUser, JwtUser } from '../common/current-user.decorator';
import { BoletasService } from './boletas.service';
import {
  ComentarioBoletaDto,
  ListarBoletasDto,
  ResponderBoletaDto,
  AtenderBoletaDto,
  FiltrosBoletaDto,
} from './boletas.dto';
@Controller('boletas')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BoletasController {
  constructor(private readonly service: BoletasService) {}
  @Get('filtros')
  @Header('Cache-Control', 'private, no-store')
  @Roles('ADMINISTRATIVO', 'DIRECTOR', 'MAESTRO')
  filtros(@Query() q: FiltrosBoletaDto, @CurrentUser() u: JwtUser) {
    return this.service.filtros(q, u);
  }
  @Get('mis-pendientes')
  @Header('Cache-Control', 'private, no-store')
  @Roles('ALUMNO')
  misPendientes(@CurrentUser() u: JwtUser) {
    return this.service.misPendientes(u);
  }
  @Post('inscripciones/:id/atencion')
  @Roles('ADMINISTRATIVO', 'DIRECTOR')
  atender(@Param('id', ParseIntPipe) id: number, @Body() d: AtenderBoletaDto, @CurrentUser() u: JwtUser) {
    return this.service.atender(id, d, u);
  }
  @Get('inscripciones/:id/constancias/:respuestaId/pdf')
  @Roles('ALUMNO', 'ADMINISTRATIVO', 'DIRECTOR')
  async constancia(
    @Param('id', ParseIntPipe) id: number,
    @Param('respuestaId', ParseIntPipe) respuestaId: number,
    @CurrentUser() u: JwtUser,
    @Res() res: Response,
  ) {
    const buffer = await this.service.constancia(id, respuestaId, u);
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Disposition', contentDisposition(`constancia-boleta-${respuestaId}.pdf`, 'attachment'));
    res.send(buffer);
  }
  @Get('seguimiento')
  @Header('Cache-Control', 'private, no-store')
  @Roles('ADMINISTRATIVO', 'DIRECTOR', 'MAESTRO')
  listar(@Query() q: ListarBoletasDto, @CurrentUser() u: JwtUser) {
    return this.service.listar(q, u);
  }
  @Get('inscripciones/:id')
  @Header('Cache-Control', 'private, no-store')
  @Roles('ALUMNO', 'ADMINISTRATIVO', 'DIRECTOR', 'MAESTRO')
  detalle(@Param('id', ParseIntPipe) id: number, @CurrentUser() u: JwtUser) {
    return this.service.detalle(id, u);
  }
  @Post('inscripciones/:id/responder')
  @Roles('ALUMNO')
  responder(@Param('id', ParseIntPipe) id: number, @Body() d: ResponderBoletaDto, @CurrentUser() u: JwtUser) {
    return this.service.responder(id, d, u);
  }
  @Post('inscripciones/:id/comentarios')
  @Roles('MAESTRO')
  comentar(@Param('id', ParseIntPipe) id: number, @Body() d: ComentarioBoletaDto, @CurrentUser() u: JwtUser) {
    return this.service.comentar(id, d, u);
  }
}
