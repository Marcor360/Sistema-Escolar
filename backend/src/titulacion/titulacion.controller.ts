import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { CurrentUser, JwtUser } from '../common/current-user.decorator';
import { PaginacionDto } from '../common/paginacion.dto';
import { CrearExpedienteTitulacionDto } from './titulacion.dto';
import { TitulacionService } from './titulacion.service';

@ApiTags('titulación')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('DIRECTOR')
@Controller('titulacion/expedientes')
export class TitulacionController {
  constructor(private readonly titulacion: TitulacionService) {}

  @Get()
  @ApiOperation({ summary: 'Consultar borradores propios de titulación según planteles del director' })
  listar(@Query() query: PaginacionDto, @CurrentUser() actor: JwtUser) {
    return this.titulacion.listar(query, actor);
  }

  @Post()
  @ApiOperation({ summary: 'Registrar borrador sin firma ni envío SEP; validar egreso, carrera y plantel' })
  crear(@Body() dto: CrearExpedienteTitulacionDto, @CurrentUser() actor: JwtUser) {
    return this.titulacion.crearBorrador(dto, actor);
  }
}
