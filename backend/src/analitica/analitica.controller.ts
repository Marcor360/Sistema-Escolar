import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { CurrentUser, JwtUser } from '../common/current-user.decorator';
import { AnaliticaDto } from './analitica.dto';
import { AnaliticaService } from './analitica.service';
@ApiTags('analitica') @ApiBearerAuth() @Controller('analitica') @UseGuards(JwtAuthGuard, RolesGuard) @Roles('ADMINISTRATIVO', 'FINANZAS', 'MAESTRO')
export class AnaliticaController {
  constructor(private readonly service: AnaliticaService) {}
  @Get() consultar(@Query() query: AnaliticaDto, @CurrentUser() user: JwtUser) { return this.service.consultar(query, user); }
}
