import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { CurrentUser, JwtUser } from '../common/current-user.decorator';
import { RegistrarFirmanteDto } from './firmantes.dto';
import { FirmantesService } from './firmantes.service';

@ApiTags('titulación - firmantes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('DIRECTOR')
@Controller('titulacion/firmantes')
export class FirmantesController {
  constructor(private readonly firmantes: FirmantesService) {}

  @Get()
  @ApiOperation({ summary: 'Consultar firmantes del plantel sin exponer CURP ni material criptográfico' })
  listar(@Query('plantelId', ParseIntPipe) plantelId: number, @CurrentUser() actor: JwtUser) {
    return this.firmantes.listar(plantelId, actor);
  }

  @Post()
  @ApiOperation({ summary: 'Registrar firmante pendiente de autorización SEP; sin cargar claves privadas' })
  registrar(@Body() dto: RegistrarFirmanteDto, @CurrentUser() actor: JwtUser) {
    return this.firmantes.registrar(dto, actor);
  }

  @Patch(':id/desactivar')
  @ApiOperation({ summary: 'Retirar firmante para operaciones futuras, conservando su historial' })
  desactivar(@Param('id', ParseIntPipe) id: number, @CurrentUser() actor: JwtUser) {
    return this.firmantes.desactivar(id, actor);
  }
}
