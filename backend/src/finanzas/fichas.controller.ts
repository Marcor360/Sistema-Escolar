import { Body, Controller, Get, Header, Param, ParseIntPipe, Post, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { CurrentUser, JwtUser } from '../common/current-user.decorator';
import { contentDisposition } from '../common/content-disposition';
import { RegistrarPagoFichaDto } from './fichas.dto';
import { FichasService } from './fichas.service';

@ApiTags('finanzas')
@ApiBearerAuth()
@Controller('finanzas/fichas')
@UseGuards(JwtAuthGuard, RolesGuard)
export class FichasController {
  constructor(private readonly servicio: FichasService) {}
  @Header('Cache-Control', 'private, no-store')
  @Get(':id') @Roles('ALUMNO', 'ADMINISTRATIVO', 'FINANZAS')
  @ApiOperation({ summary: 'Consultar ficha de cargo dentro del alcance del usuario' })
  obtener(@Param('id', ParseIntPipe) id: number, @CurrentUser() u: JwtUser) { return this.servicio.obtener(id,u); }
  @Get(':id/pdf') @Roles('ALUMNO', 'ADMINISTRATIVO', 'FINANZAS')
  @ApiOperation({ summary: 'Ficha de pago PDF privada y sin caché' })
  async pdf(@Param('id', ParseIntPipe) id: number, @CurrentUser() u: JwtUser, @Res() res: Response) {
    const archivo = await this.servicio.generarPdf(id,u);
    res.setHeader('Content-Type','application/pdf');
    res.setHeader('Content-Disposition',contentDisposition('ficha-' + id + '.pdf','attachment'));
    res.setHeader('Cache-Control','private, no-store');
    res.setHeader('X-Content-Type-Options','nosniff');
    res.end(archivo);
  }
  @Post('registrar') @Roles('FINANZAS')
  @ApiOperation({ summary: 'Aplicar pago manual por identificador tras cotejar comprobante; no es integración bancaria automática' })
  registrar(@Body() d: RegistrarPagoFichaDto, @CurrentUser() u: JwtUser) { return this.servicio.registrar(d,u); }
}
