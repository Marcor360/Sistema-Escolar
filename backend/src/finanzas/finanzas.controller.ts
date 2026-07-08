import { Body, Controller, Get, HttpCode, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { ConceptosService } from './conceptos.service';
import { CargosService } from './cargos.service';
import { PagosService } from './pagos.service';
import { OrdenesService } from './ordenes.service';
import { CobranzaService } from './cobranza.service';
import { BitacoraFinancieraService } from './bitacora-financiera.service';
import { OpenpayWebhookGuard } from './openpay-webhook.guard';
import {
  AplicarRecargosDto, ConceptoDto, CrearCargoDto, CrearOrdenDto,
  GenerarColegiaturasDto, RegistrarPagoDto,
} from './finanzas.dto';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { CurrentUser, JwtUser } from '../common/current-user.decorator';

@ApiTags('finanzas')
@Controller('finanzas')
export class FinanzasController {
  constructor(
    private readonly conceptos: ConceptosService,
    private readonly cargos: CargosService,
    private readonly pagos: PagosService,
    private readonly ordenes: OrdenesService,
    private readonly cobranza: CobranzaService,
    private readonly bitacora: BitacoraFinancieraService,
  ) {}

  /** Webhook de Openpay: Basic Auth opcional; exento del rate-limit (la pasarela reintenta). */
  @Post('webhook/openpay')
  @HttpCode(200)
  @SkipThrottle()
  @UseGuards(OpenpayWebhookGuard)
  webhook(@Body() payload: Record<string, unknown>) {
    return this.ordenes.procesarWebhook(payload);
  }

  // ---------- Portal/app del alumno ----------
  @Get('me/estado-cuenta')
  @ApiBearerAuth() @UseGuards(JwtAuthGuard, RolesGuard) @Roles('ALUMNO')
  miEstadoDeCuenta(@CurrentUser() user: JwtUser) {
    return this.cargos.miEstadoDeCuenta(user);
  }

  @Post('ordenes')
  @ApiBearerAuth() @UseGuards(JwtAuthGuard, RolesGuard) @Roles('ALUMNO', 'FINANZAS')
  crearOrden(@Body() dto: CrearOrdenDto, @CurrentUser() user: JwtUser) {
    return this.ordenes.crear(dto.cargoId, user);
  }

  @Get('ordenes/:id')
  @ApiBearerAuth() @UseGuards(JwtAuthGuard, RolesGuard) @Roles('ALUMNO', 'FINANZAS')
  obtenerOrden(@Param('id', ParseIntPipe) id: number) {
    return this.ordenes.obtener(id);
  }

  // ---------- Catálogo de conceptos ----------
  @Get('conceptos')
  @ApiBearerAuth() @UseGuards(JwtAuthGuard, RolesGuard) @Roles('FINANZAS', 'ADMINISTRATIVO', 'ALUMNO')
  listarConceptos() { return this.conceptos.listar(); }

  @Post('conceptos')
  @ApiBearerAuth() @UseGuards(JwtAuthGuard, RolesGuard) @Roles('FINANZAS')
  crearConcepto(@Body() dto: ConceptoDto) { return this.conceptos.crear(dto); }

  @Patch('conceptos/:id')
  @ApiBearerAuth() @UseGuards(JwtAuthGuard, RolesGuard) @Roles('FINANZAS')
  actualizarConcepto(@Param('id', ParseIntPipe) id: number, @Body() dto: Partial<ConceptoDto>) {
    return this.conceptos.actualizar(id, dto);
  }

  // ---------- Cuentas por cobrar ----------
  @Get('cargos')
  @ApiBearerAuth() @UseGuards(JwtAuthGuard, RolesGuard) @Roles('FINANZAS', 'ADMINISTRATIVO')
  listarCargos(
    @Query('alumnoId') alumnoId?: string,
    @Query('estatus') estatus?: string,
    @Query('periodo') periodo?: string,
  ) {
    return this.cargos.listar({
      alumnoId: alumnoId ? Number(alumnoId) : undefined,
      estatus,
      periodo,
    });
  }

  @Post('cargos')
  @ApiBearerAuth() @UseGuards(JwtAuthGuard, RolesGuard) @Roles('FINANZAS')
  crearCargo(@Body() dto: CrearCargoDto, @CurrentUser() user: JwtUser) {
    return this.cargos.crear(dto, user);
  }

  @Post('cargos/generar-colegiaturas')
  @ApiBearerAuth() @UseGuards(JwtAuthGuard, RolesGuard) @Roles('FINANZAS')
  generarColegiaturas(@Body() dto: GenerarColegiaturasDto, @CurrentUser() user: JwtUser) {
    return this.cargos.generarColegiaturas(dto, user);
  }

  @Post('cargos/aplicar-recargos')
  @ApiBearerAuth() @UseGuards(JwtAuthGuard, RolesGuard) @Roles('FINANZAS')
  aplicarRecargos(@Body() dto: AplicarRecargosDto, @CurrentUser() user: JwtUser) {
    return this.cargos.aplicarRecargos(dto, user);
  }

  @Get('alumnos/:id/estado-cuenta')
  @ApiBearerAuth() @UseGuards(JwtAuthGuard, RolesGuard) @Roles('FINANZAS', 'ADMINISTRATIVO')
  estadoDeCuenta(@Param('id', ParseIntPipe) id: number) {
    return this.cargos.estadoDeCuenta(id);
  }

  @Get('adeudos')
  @ApiBearerAuth() @UseGuards(JwtAuthGuard, RolesGuard) @Roles('FINANZAS', 'ADMINISTRATIVO')
  adeudos() { return this.cargos.adeudos(); }

  // ---------- Pagos ----------
  @Get('pagos')
  @ApiBearerAuth() @UseGuards(JwtAuthGuard, RolesGuard) @Roles('FINANZAS', 'ADMINISTRATIVO')
  listarPagos(@Query('alumnoId') alumnoId?: string) {
    return this.pagos.listar(alumnoId ? Number(alumnoId) : undefined);
  }

  @Post('pagos')
  @ApiBearerAuth() @UseGuards(JwtAuthGuard, RolesGuard) @Roles('FINANZAS')
  registrarPago(@Body() dto: RegistrarPagoDto, @CurrentUser() user: JwtUser) {
    return this.pagos.registrarManual(dto, user);
  }

  // ---------- Cobranza y bitácora ----------
  @Post('avisos-cobranza')
  @ApiBearerAuth() @UseGuards(JwtAuthGuard, RolesGuard) @Roles('FINANZAS')
  avisos(@CurrentUser() user: JwtUser) { return this.cobranza.enviarAvisos(user); }

  @Get('bitacora')
  @ApiBearerAuth() @UseGuards(JwtAuthGuard, RolesGuard) @Roles('FINANZAS')
  bitacoraFinanciera() { return this.bitacora.listar(); }
}
