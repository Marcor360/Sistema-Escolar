import { Body, Controller, Get, Header, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { ConfiguracionBancoService } from './configuracion-banco.service';
import { ConfigurarBbvaDto } from './configuracion-banco.dto';
@ApiTags('configuracion')
@ApiBearerAuth()
@Controller('configuracion/bbva')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPERADMIN')
export class ConfiguracionBancoController {
  constructor(private readonly s: ConfiguracionBancoService) {}
  @Header('Cache-Control', 'private, no-store')
  @Get() @ApiOperation({ summary: 'Consulta de cuenta BBVA, exclusiva de SUPERADMIN' })
  obtener() { return this.s.obtener(); }
  @Put() @ApiOperation({ summary: 'Editar cuenta BBVA, exclusivo de SUPERADMIN' })
  actualizar(@Body() d: ConfigurarBbvaDto) { return this.s.actualizar(d); }
}
