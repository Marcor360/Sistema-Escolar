import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { CurrentUser, JwtUser } from '../common/current-user.decorator';
import { SeguimientoService } from './seguimiento.service';
import { TramitesService } from './tramites.service';
import { BancoService } from './banco.service';
import { NuevoTramiteDto, CambiarTramiteDto, PreferenciasDto } from './seguimiento.dto';
import { ImportarBancoDto, AplicarMovimientoDto } from './banco.dto';
@ApiTags('seguimiento')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('seguimiento')
export class SeguimientoController {
  constructor(
    private readonly s: SeguimientoService,
    private readonly t: TramitesService,
    private readonly b: BancoService,
  ) {}
  @Get('respaldo') @Roles('SUPERADMIN') respaldo() {
    return this.s.respaldo();
  }
  @Get('pendientes') pendientes(@CurrentUser() u: JwtUser) {
    return this.s.pendientes(u);
  }
  @Get('calidad') @Roles('ADMINISTRATIVO') calidad(@CurrentUser() u: JwtUser) {
    return this.s.calidad(u);
  }
  @Get('preferencias') preferencias(@CurrentUser() u: JwtUser) {
    return this.s.preferencias(u);
  }
  @Patch('preferencias') guardarPreferencias(@Body() d: PreferenciasDto, @CurrentUser() u: JwtUser) {
    return this.s.guardarPreferencias(d, u);
  }
  @Get('sesiones') sesiones(@CurrentUser() u: JwtUser) {
    return this.s.sesiones(u);
  }
  @Delete('sesiones/:id') revocar(@Param('id', new ParseUUIDPipe()) id: string, @CurrentUser() u: JwtUser) {
    return this.s.revocarSesion(id, u);
  }
  @Get('tramites') @Roles('ALUMNO', 'ADMINISTRATIVO') tramites(@CurrentUser() u: JwtUser) {
    return this.t.listar(u);
  }
  @Post('tramites') @Roles('ALUMNO') crear(@Body() d: NuevoTramiteDto, @CurrentUser() u: JwtUser) {
    return this.t.crear(d, u);
  }
  @Get('tramites/:id/historial') @Roles('ALUMNO', 'ADMINISTRATIVO') historial(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() u: JwtUser,
  ) {
    return this.t.historial(id, u);
  }
  @Patch('tramites/:id') @Roles('ALUMNO', 'ADMINISTRATIVO') cambiar(
    @Param('id', ParseIntPipe) id: number,
    @Body() d: CambiarTramiteDto,
    @CurrentUser() u: JwtUser,
  ) {
    return this.t.cambiar(id, d, u);
  }
  @Get('movimientos') @Roles('FINANZAS') movimientos(@CurrentUser() u: JwtUser) {
    return this.b.listar(u);
  }
  @Post('movimientos/preview') @Roles('FINANZAS') preview(@Body() d: ImportarBancoDto, @CurrentUser() u: JwtUser) {
    return this.b.preview(d, u);
  }
  @Post('movimientos') @Roles('FINANZAS') importar(@Body() d: ImportarBancoDto, @CurrentUser() u: JwtUser) {
    return this.b.importar(d, u);
  }
  @Post('movimientos/:id/aplicar') @Roles('FINANZAS') aplicar(
    @Param('id', ParseIntPipe) id: number,
    @Body() d: AplicarMovimientoDto,
    @CurrentUser() u: JwtUser,
  ) {
    return this.b.aplicar(id, d.cargoId, u);
  }
}
