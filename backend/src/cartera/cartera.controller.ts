import { ReinscripcionPeriodoService } from './reinscripcion-periodo.service';
import { AnularReinscripcionDto, AutorizarReinscripcionDto, ConfirmarPeriodoDto, ReinscripcionPeriodoDto } from './reinscripcion-periodo.dto';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Body, Controller, Get, Param, ParseIntPipe, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser, JwtUser } from '../common/current-user.decorator';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { CarteraService } from './cartera.service';
import { ConfirmarCarteraDto, ListarCarteraDto, PrevisualizarCarteraDto } from './cartera.dto';
@ApiTags('cartera') @ApiBearerAuth() @Controller('cartera') @UseGuards(JwtAuthGuard, RolesGuard) @Roles('ADMINISTRATIVO')
export class CarteraController {
  constructor(private readonly s: CarteraService, private readonly r: ReinscripcionPeriodoService) {}
  @Get('reinscripciones/alumnos/:alumnoId') @Roles('FINANZAS','ADMINISTRATIVO')
  @ApiOperation({ summary: 'Trayectoria de alumno existente para reinscribirlo en ciclo posterior' })
  trayectoria(@Param('alumnoId', ParseIntPipe) alumnoId: number, @CurrentUser() u: JwtUser) { return this.r.trayectoria(alumnoId,u); }
  @Post('reinscripciones/previsualizar') @Roles('FINANZAS','ADMINISTRATIVO')
  @ApiOperation({ summary: 'Cotiza reinscripción con periodo y ajustes autorizados sin modificar historial' })
  previewReinscripcion(@Body() d: ReinscripcionPeriodoDto, @CurrentUser() u: JwtUser) { return this.r.preview(d,u); }
  @Post('reinscripciones/confirmar') @Roles('ADMINISTRATIVO')
  @ApiOperation({ summary: 'Control Escolar confirma precio autorizado; asignación/cargos atómicos por periodo sin tocar historial' })
  confirmarReinscripcion(@Body() d: ConfirmarPeriodoDto, @CurrentUser() u: JwtUser) { return this.r.confirmar(d,u); }
  @Post('reinscripciones/autorizar-precio') @Roles('FINANZAS')
  @ApiOperation({summary:'Finanzas autoriza total, cuotas y descuentos únicamente del periodo destino'})
  autorizar(@Body() d:AutorizarReinscripcionDto,@CurrentUser() u:JwtUser){return this.r.autorizar(d,u);}
  @Get('reinscripciones/autorizaciones/:alumnoId') @Roles('FINANZAS','ADMINISTRATIVO')
  autorizaciones(@Param('alumnoId',ParseIntPipe) alumnoId:number,@CurrentUser() u:JwtUser){return this.r.autorizaciones(alumnoId,u);}
  @Get('reinscripciones/historial') @Roles('FINANZAS','ADMINISTRATIVO')
  reinscripciones(@Query() q:ListarCarteraDto,@CurrentUser() u:JwtUser){return this.r.listar(q,u);}
  @Get('reinscripciones/operaciones/:id') @Roles('FINANZAS','ADMINISTRATIVO')
  reinscripcion(@Param('id',ParseIntPipe) id:number,@CurrentUser() u:JwtUser){return this.r.obtener(id,u);}
  @Post('reinscripciones/operaciones/:id/anular') @Roles('ADMINISTRATIVO')
  anular(@Param('id',ParseIntPipe) id:number,@Body() d:AnularReinscripcionDto,@CurrentUser() u:JwtUser){return this.r.anular(id,d,u);}
  @Get() listar(@Query() q: ListarCarteraDto, @CurrentUser() u: JwtUser) { return this.s.listar(q,u); }
  @Get(':id') obtener(@Param('id', ParseIntPipe) id: number, @CurrentUser() u: JwtUser) { return this.s.obtener(id,u); }
  @Post('previsualizar') preview(@Body() d: PrevisualizarCarteraDto, @CurrentUser() u: JwtUser) { return this.s.previsualizar(d,u); }
  @Post('confirmar') confirmar(@Body() d: ConfirmarCarteraDto, @CurrentUser() u: JwtUser) { return this.s.confirmar(d,u); }
}
