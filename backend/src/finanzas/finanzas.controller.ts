import { Body, Controller, Get, HttpCode, Param, ParseIntPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { ConceptosService } from './conceptos.service';
import { CargosService } from './cargos.service';
import { PagosService } from './pagos.service';
import { OrdenesService } from './ordenes.service';
import { CobranzaService } from './cobranza.service';
import { BitacoraFinancieraService } from './bitacora-financiera.service';
import { OpenpayWebhookGuard } from './openpay-webhook.guard';
import {
  AplicarRecargosDto, ActualizarConceptoDto, ConceptoDto, CrearCargoDto, CrearOrdenDto,
  GenerarColegiaturasDto, ListarCargosDto, ListarPagosDto, RegistrarPagoDto, MotivoFinancieroDto, CobranzaDto, AplicarPagoDto,
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
  crearOrden(@Body() dto: CrearOrdenDto, @CurrentUser() user: JwtUser, @Req() req: Request) {
    return this.ordenes.crear(dto.cargoId, user, req.ip);
  }

  @Get('ordenes/:id')
  @ApiBearerAuth() @UseGuards(JwtAuthGuard, RolesGuard) @Roles('ALUMNO', 'FINANZAS')
  obtenerOrden(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) {
    return this.ordenes.obtener(id, user);
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
  actualizarConcepto(@Param('id', ParseIntPipe) id: number, @Body() dto: ActualizarConceptoDto) {
    return this.conceptos.actualizar(id, dto);
  }

  // ---------- Cuentas por cobrar ----------
  @Get('cargos')
  @ApiBearerAuth() @UseGuards(JwtAuthGuard, RolesGuard) @Roles('FINANZAS', 'ADMINISTRATIVO')
  listarCargos(@CurrentUser() user: JwtUser, @Query() query: ListarCargosDto) {
    return this.cargos.listar(query, user);
  }

  @Post('cargos')
  @ApiBearerAuth() @UseGuards(JwtAuthGuard, RolesGuard) @Roles('FINANZAS')
  crearCargo(@Body() dto: CrearCargoDto, @CurrentUser() user: JwtUser) {
    return this.cargos.crear(dto, user);
  }

  @Get('conciliacion/ordenes')
  @ApiBearerAuth() @UseGuards(JwtAuthGuard, RolesGuard) @Roles('FINANZAS')
  incidenciasOrdenes(@CurrentUser() user: JwtUser, @Query() query: ListarPagosDto) { return this.ordenes.incidencias(user, query.pagina); }
  @Get('conciliacion/pagos')
  @ApiBearerAuth() @UseGuards(JwtAuthGuard, RolesGuard) @Roles('FINANZAS')
  incidenciasPagos(@CurrentUser() user: JwtUser, @Query() query: ListarPagosDto) { return this.pagos.noAplicados(user, query.pagina); }
  @Post('ordenes/:id/conciliacion')
  @ApiBearerAuth() @UseGuards(JwtAuthGuard, RolesGuard) @Roles('FINANZAS')
  conciliarOrden(@Param('id', ParseIntPipe) id: number, @Body() dto: MotivoFinancieroDto, @CurrentUser() user: JwtUser) {
    return this.ordenes.conciliar(id, dto.motivo, user);
  }
  @Post('pagos/:id/aplicacion')
  @ApiBearerAuth() @UseGuards(JwtAuthGuard, RolesGuard) @Roles('FINANZAS')
  aplicarPago(@Param('id', ParseIntPipe) id: number, @Body() dto: AplicarPagoDto, @CurrentUser() user: JwtUser) {
    return this.pagos.aplicarNoAplicado(id, dto.cargoId, dto.motivo, user);
  }

  @ApiOperation({ summary: 'Cancelar cargo sin pagos aplicados ni órdenes pendientes; motivo obligatorio' })
  @ApiResponse({ status: 400, description: 'Datos o transición inválidos' })
  @ApiResponse({ status: 401, description: 'Sesión expirada o revocada' })
  @ApiResponse({ status: 403, description: 'Rol, portal, alcance u origen no autorizado' })
  @ApiResponse({ status: 409, description: 'Conflicto con el estado actual' })
  @Post('cargos/:id/cancelacion')
  @ApiBearerAuth() @UseGuards(JwtAuthGuard, RolesGuard) @Roles('FINANZAS')
  cancelarCargo(@Param('id', ParseIntPipe) id: number, @Body() dto: MotivoFinancieroDto, @CurrentUser() user: JwtUser) {
    return this.cargos.cancelar(id, dto.motivo, user);
  }

  @ApiOperation({ summary: 'Anular pago manual y recalcular cargo conservando auditoría' })
  @ApiResponse({ status: 400, description: 'Datos o transición inválidos' })
  @ApiResponse({ status: 401, description: 'Sesión expirada o revocada' })
  @ApiResponse({ status: 403, description: 'Rol, portal, alcance u origen no autorizado' })
  @ApiResponse({ status: 409, description: 'Conflicto con el estado actual' })
  @Post('pagos/:id/anulacion')
  @ApiBearerAuth() @UseGuards(JwtAuthGuard, RolesGuard) @Roles('FINANZAS')
  anularPago(@Param('id', ParseIntPipe) id: number, @Body() dto: MotivoFinancieroDto, @CurrentUser() user: JwtUser) {
    return this.pagos.anular(id, dto.motivo, user);
  }

  @Post('cargos/preview-colegiaturas')
  @ApiBearerAuth() @UseGuards(JwtAuthGuard, RolesGuard) @Roles('FINANZAS')
  previewColegiaturas(@Body() dto: GenerarColegiaturasDto, @CurrentUser() user: JwtUser) {
    return this.cargos.generarColegiaturas(dto, user, true);
  }
  @Post('cargos/preview-recargos')
  @ApiBearerAuth() @UseGuards(JwtAuthGuard, RolesGuard) @Roles('FINANZAS')
  previewRecargos(@Body() dto: AplicarRecargosDto, @CurrentUser() user: JwtUser) {
    return this.cargos.aplicarRecargos(dto, user, true);
  }
  @Post('preview-cobranza')
  @ApiBearerAuth() @UseGuards(JwtAuthGuard, RolesGuard) @Roles('FINANZAS')
  previewCobranza(@Body() dto: CobranzaDto, @CurrentUser() user: JwtUser) {
    return this.cobranza.enviarAvisos(user, dto.plantelId, true);
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
  estadoDeCuenta(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) {
    return this.cargos.estadoDeCuenta(id, user);
  }

  @Get('adeudos')
  @ApiBearerAuth() @UseGuards(JwtAuthGuard, RolesGuard) @Roles('FINANZAS', 'ADMINISTRATIVO')
  adeudos(@CurrentUser() user: JwtUser, @Query() query: ListarCargosDto) {
    return this.cargos.adeudosPaginados(user, query);
  }

  // ---------- Pagos ----------
  @Get('pagos')
  @ApiBearerAuth() @UseGuards(JwtAuthGuard, RolesGuard) @Roles('FINANZAS', 'ADMINISTRATIVO')
  listarPagos(@CurrentUser() user: JwtUser, @Query() query: ListarPagosDto) {
    return this.pagos.listar(query, user);
  }

  @Post('pagos')
  @ApiBearerAuth() @UseGuards(JwtAuthGuard, RolesGuard) @Roles('FINANZAS')
  registrarPago(@Body() dto: RegistrarPagoDto, @CurrentUser() user: JwtUser) {
    return this.pagos.registrarManual(dto, user);
  }

  // ---------- Cobranza y bitácora ----------
  @Post('avisos-cobranza')
  @ApiBearerAuth() @UseGuards(JwtAuthGuard, RolesGuard) @Roles('FINANZAS')
  avisos(@CurrentUser() user: JwtUser, @Body() dto: CobranzaDto) { return this.cobranza.enviarAvisos(user, dto.plantelId, false, dto.confirmado); }

  @Get('bitacora')
  @ApiBearerAuth() @UseGuards(JwtAuthGuard, RolesGuard) @Roles('FINANZAS')
  bitacoraFinanciera(@CurrentUser() user: JwtUser) { return this.bitacora.listar(user); }
}
