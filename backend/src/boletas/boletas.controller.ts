import { Body, Controller, Get, Header, Param, ParseIntPipe, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { CurrentUser, JwtUser } from '../common/current-user.decorator';
import { BoletasService } from './boletas.service';
import { ComentarioBoletaDto, ListarBoletasDto, ResponderBoletaDto } from './boletas.dto';
@Controller('boletas')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BoletasController {
  constructor(private readonly service: BoletasService) {}
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
