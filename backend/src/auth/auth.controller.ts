import { Body, Controller, ForbiddenException, Get, Headers, Ip, Post, Req, Res, UnauthorizedException, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { ConsentimientoInstitucionalService } from './consentimiento-institucional.service';
import { AceptarConsentimientoDto } from './dto/consentimiento.dto';
import { ActivacionService } from './activacion.service';
import { ActivarCuentaDto, CambiarPasswordDto, ForgotPasswordDto, LoginDto, ResetPasswordDto, RefreshDto } from './dto/auth.dto';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { CurrentUser, JwtUser } from '../common/current-user.decorator';
import { Portal, PortalActual } from '../common/portales';

const LIMITE_ESTRICTO = { default: { limit: 5, ttl: 60_000 } };

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService, private readonly activacion: ActivacionService, private readonly consentimiento: ConsentimientoInstitucionalService) {}

  @ApiOperation({ summary: 'Iniciar sesión: access 15 minutos; refresh web en cookie HttpOnly o móvil en respuesta' })
  @ApiResponse({ status: 400, description: 'Datos o transición inválidos' })
  @ApiResponse({ status: 401, description: 'Sesión expirada o revocada' })
  @ApiResponse({ status: 403, description: 'Rol, portal, alcance u origen no autorizado' })
  @ApiResponse({ status: 409, description: 'Conflicto con el estado actual' })
  @Post('login')
  @Throttle(LIMITE_ESTRICTO)
  async login(@Body() dto: LoginDto, @PortalActual() portal: Portal, @Ip() ip: string, @Res({ passthrough: true }) res: Response, @Headers('user-agent') agente?:string) {
    return this.responder(await this.auth.login(dto.email, dto.password, portal, ip, agente), portal, res);
  }

  private responder(tokens: Awaited<ReturnType<AuthService['login']>>, portal: Portal, res: Response) {
    if (portal === 'MOVIL') return tokens;
    res.cookie('escolar_refresh', tokens.refreshToken, { httpOnly: true, secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict', path: '/api/auth', maxAge: 30 * 24 * 60 * 60 * 1000 });
    return { accessToken: tokens.accessToken, usuario: tokens.usuario };
  }

  @ApiOperation({ summary: 'Rotar refresh: web exige origen permitido y cookie; móvil envía refreshToken' })
  @ApiResponse({ status: 400, description: 'Datos o transición inválidos' })
  @ApiResponse({ status: 401, description: 'Sesión expirada o revocada' })
  @ApiResponse({ status: 403, description: 'Rol, portal, alcance u origen no autorizado' })
  @ApiResponse({ status: 409, description: 'Conflicto con el estado actual' })
  @Post('refresh')
  async refresh(@Body() dto: RefreshDto, @PortalActual() portal: Portal, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    let token = dto.refreshToken;
    if (portal === 'WEB') {
      const origen = req.headers.origin;
      const permitidos = (process.env.CORS_ORIGINS || 'http://localhost:5173').split(',').map((o) => o.trim());
      if (!origen || !permitidos.includes(origen)) throw new ForbiddenException('Origen no autorizado para renovar sesión');
      token = req.headers.cookie?.split(';').map((c) => c.trim()).find((c) => c.startsWith('escolar_refresh='))?.slice('escolar_refresh='.length);
    }
    if (!token) throw new UnauthorizedException('No hay sesión para renovar');
    return this.responder(await this.auth.refresh(token, portal), portal, res);
  }

  @Get('consentimiento')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Consultar los documentos y la aceptación institucional registrada del alumno' })
  @UseGuards(JwtAuthGuard)
  consultarConsentimiento(@CurrentUser() user: JwtUser) { return this.consentimiento.estado(user); }

  @Post('consentimiento')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Registrar fecha UTC y versiones aceptadas por el alumno' })
  @UseGuards(JwtAuthGuard)
  aceptarConsentimiento(@CurrentUser() user: JwtUser, @Body() dto: AceptarConsentimientoDto) {
    return this.consentimiento.aceptar(user, dto.versiones);
  }

  @Post('actividad')
  @ApiOperation({ summary: 'Registrar actividad explícita del usuario (no polling), límite de sesión 30 minutos' })
  @ApiBearerAuth()
  @ApiResponse({ status: 401, description: 'Sesión expirada o revocada' })
  @Throttle({ default: { limit: 12, ttl: 60_000 } })
  @UseGuards(JwtAuthGuard)
  actividad(@CurrentUser() user: JwtUser) {
    return this.auth.registrarActividad(user);
  }

  @Get('me')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: JwtUser) {
    return this.auth.me(user);
  }

  @ApiOperation({ summary: 'Revocar la sesión del dispositivo actual' })
  @ApiResponse({ status: 400, description: 'Datos o transición inválidos' })
  @ApiResponse({ status: 401, description: 'Sesión expirada o revocada' })
  @ApiResponse({ status: 403, description: 'Rol, portal, alcance u origen no autorizado' })
  @ApiResponse({ status: 409, description: 'Conflicto con el estado actual' })
  @Post('logout')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  logout(@CurrentUser() user: JwtUser, @Res({ passthrough: true }) res: Response) {
    res.clearCookie('escolar_refresh', { path: '/api/auth' });
    return this.auth.logout(user);
  }

  @ApiOperation({ summary: 'Cambiar contraseña e invalidar todas las sesiones' })
  @ApiResponse({ status: 400, description: 'Datos o transición inválidos' })
  @ApiResponse({ status: 401, description: 'Sesión expirada o revocada' })
  @ApiResponse({ status: 403, description: 'Rol, portal, alcance u origen no autorizado' })
  @ApiResponse({ status: 409, description: 'Conflicto con el estado actual' })
  @Post('cambiar-password')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Throttle(LIMITE_ESTRICTO)
  cambiarPassword(@CurrentUser() user: JwtUser, @Body() dto: CambiarPasswordDto) {
    return this.auth.cambiarPassword(user.sub, dto.actual, dto.nueva);
  }

  @Post('solicitar-activacion')
  @ApiOperation({ summary: 'Solicitar invitación de un solo uso sin revelar existencia de cuenta' })
  @Throttle(LIMITE_ESTRICTO)
  solicitarActivacion(@Body() dto: ForgotPasswordDto) { return this.activacion.solicitar(dto.email); }

  @Post('activar-cuenta')
  @ApiOperation({ summary: 'Activar cuenta pendiente mediante código y contraseña nueva' })
  @Throttle(LIMITE_ESTRICTO)
  activarCuenta(@Body() dto: ActivarCuentaDto) { return this.activacion.activar(dto.token, dto.password); }

  @Post('forgot-password')
  @Throttle(LIMITE_ESTRICTO)
  forgot(@Body() dto: ForgotPasswordDto) {
    return this.auth.forgotPassword(dto.email);
  }

  @Post('reset-password')
  @Throttle(LIMITE_ESTRICTO)
  reset(@Body() dto: ResetPasswordDto) {
    return this.auth.resetPassword(dto.token, dto.password);
  }
}
