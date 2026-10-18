import { Body, Controller, Get, Param, ParseIntPipe, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser, JwtUser } from '../common/current-user.decorator';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { CarteraService } from './cartera.service';
import { ConfirmarCarteraDto, ListarCarteraDto, PrevisualizarCarteraDto } from './cartera.dto';
@Controller('cartera') @UseGuards(JwtAuthGuard, RolesGuard) @Roles('ADMINISTRATIVO')
export class CarteraController {
  constructor(private readonly s: CarteraService) {}
  @Get() listar(@Query() q: ListarCarteraDto, @CurrentUser() u: JwtUser) { return this.s.listar(q,u); }
  @Get(':id') obtener(@Param('id', ParseIntPipe) id: number, @CurrentUser() u: JwtUser) { return this.s.obtener(id,u); }
  @Post('previsualizar') preview(@Body() d: PrevisualizarCarteraDto, @CurrentUser() u: JwtUser) { return this.s.previsualizar(d,u); }
  @Post('confirmar') confirmar(@Body() d: ConfirmarCarteraDto, @CurrentUser() u: JwtUser) { return this.s.confirmar(d,u); }
}
