import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Body, Controller, Get, Param, ParseIntPipe, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser, JwtUser } from '../common/current-user.decorator';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { CarteraService } from './cartera.service';
import { ConfirmarCarteraDto, ConfirmarReinscripcionDto, ListarCarteraDto, PrevisualizarCarteraDto, PrevisualizarReinscripcionDto } from './cartera.dto';
@ApiTags('cartera') @ApiBearerAuth() @Controller('cartera') @UseGuards(JwtAuthGuard, RolesGuard) @Roles('ADMINISTRATIVO')
export class CarteraController {
  constructor(private readonly s: CarteraService) {}
  @Get('reinscripciones/alumnos/:alumnoId') @Roles('FINANZAS','ADMINISTRATIVO')
  @ApiOperation({ summary: 'Trayectoria de alumno existente para reinscribirlo en ciclo posterior' })
  trayectoria(@Param('alumnoId', ParseIntPipe) alumnoId: number, @CurrentUser() u: JwtUser) { return this.s.trayectoria(alumnoId,u); }
  @Post('reinscripciones/previsualizar') @Roles('FINANZAS','ADMINISTRATIVO')
  @ApiOperation({ summary: 'Cotiza reinscripción con periodo y ajustes autorizados sin modificar historial' })
  previewReinscripcion(@Body() d: PrevisualizarReinscripcionDto, @CurrentUser() u: JwtUser) { return this.s.previsualizarReinscripcion(d,u); }
  @Post('reinscripciones/confirmar') @Roles('FINANZAS','ADMINISTRATIVO')
  @ApiOperation({ summary: 'Confirma idempotentemente nueva cartera de otro ciclo y solicita agrupación sin tocar cargos previos' })
  confirmarReinscripcion(@Body() d: ConfirmarReinscripcionDto, @CurrentUser() u: JwtUser) { return this.s.confirmarReinscripcion(d,u); }
  @Get() listar(@Query() q: ListarCarteraDto, @CurrentUser() u: JwtUser) { return this.s.listar(q,u); }
  @Get(':id') obtener(@Param('id', ParseIntPipe) id: number, @CurrentUser() u: JwtUser) { return this.s.obtener(id,u); }
  @Post('previsualizar') preview(@Body() d: PrevisualizarCarteraDto, @CurrentUser() u: JwtUser) { return this.s.previsualizar(d,u); }
  @Post('confirmar') confirmar(@Body() d: ConfirmarCarteraDto, @CurrentUser() u: JwtUser) { return this.s.confirmar(d,u); }
}
