import { ApiErroresOperacion } from '../common/api-operacion';
import { AnaliticaRespuestaDto } from './respuestas.dto';
import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiOkResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { CurrentUser, JwtUser } from '../common/current-user.decorator';
import { AnaliticaDto } from './analitica.dto';
import { AnaliticaService } from './analitica.service';
@ApiErroresOperacion() @ApiTags('analitica') @ApiBearerAuth() @Controller('analitica') @UseGuards(JwtAuthGuard, RolesGuard) @Roles('ADMINISTRATIVO', 'FINANZAS', 'MAESTRO')
export class AnaliticaController {
  constructor(private readonly service: AnaliticaService) {}
  @ApiOperation({ summary: 'Indicadores vigentes o históricos por ciclo y capacidades del actor', description: 'MAESTRO + FINANZAS recibe clases propias y finanzas de sus planteles; FINANZAS no amplía el alcance académico. Ciclo cerrado conserva materias y participantes retirados.' })
  @ApiOkResponse({ type: AnaliticaRespuestaDto })
  @Get() consultar(@Query() query: AnaliticaDto, @CurrentUser() user: JwtUser) { return this.service.consultar(query, user); }
}
