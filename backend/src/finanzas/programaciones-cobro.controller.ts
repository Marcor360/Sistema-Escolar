import { Body, Controller, Get, Param, ParseIntPipe, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { CurrentUser, JwtUser } from '../common/current-user.decorator';
import { ConfirmarProgramacionDto, EmitirCuotaDto } from './programaciones-persistidas.dto';
import { ProgramacionesCobroService } from './programaciones-cobro.service';

@ApiTags('finanzas')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('FINANZAS')
@Controller('finanzas/programaciones')
export class ProgramacionesCobroController {
  constructor(private readonly service: ProgramacionesCobroService) {}

  @Post('confirmar')
  @ApiOperation({ summary: 'Autoriza y conserva cuotas sin crear cargos; inscripción activa requerida' })
  confirmar(@Body() dto: ConfirmarProgramacionDto, @CurrentUser() user: JwtUser) {
    return this.service.confirmar(dto, user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Consultar programación financiera de alumnos de planteles autorizados' })
  obtener(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) {
    return this.service.obtener(id, user);
  }

  @Post(':id/cuotas/:numero/emitir')
  @ApiOperation({ summary: 'Emite una cuota como cargo tras validar inscripción activa, ciclo y duplicados' })
  emitir(@Param('id', ParseIntPipe) id: number, @Param('numero', ParseIntPipe) numero: number,
    @Body() _dto: EmitirCuotaDto, @CurrentUser() user: JwtUser) {
    return this.service.emitir(id, numero, user);
  }
}
