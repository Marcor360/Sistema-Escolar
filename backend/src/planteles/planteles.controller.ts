import {
  Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Put, UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, JwtUser } from '../common/current-user.decorator';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { Roles } from '../common/roles.decorator';
import { RolesGuard } from '../common/roles.guard';
import { ActualizarPlantelDto, CrearPlantelDto, PersonalPlantelDto } from './planteles.dto';
import { PlantelesService } from './planteles.service';

@ApiTags('planteles')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('planteles')
export class PlantelesController {
  constructor(private readonly service: PlantelesService) {}

  @Get('mios')
  mios(@CurrentUser() user: JwtUser) { return this.service.mios(user); }

  @Get()
  @Roles('ADMINISTRATIVO', 'FINANZAS', 'MAESTRO')
  listar(@CurrentUser() user: JwtUser) { return this.service.listar(user); }

  @Get(':id')
  @Roles('ADMINISTRATIVO', 'FINANZAS')
  detalle(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) {
    return this.service.detalle(id, user);
  }

  @Post()
  @Roles('SUPERADMIN')
  crear(@Body() dto: CrearPlantelDto) { return this.service.crear(dto); }

  @Patch(':id')
  @Roles('SUPERADMIN')
  actualizar(@Param('id', ParseIntPipe) id: number, @Body() dto: ActualizarPlantelDto) {
    return this.service.actualizar(id, dto);
  }

  @Put(':id/director')
  @Roles('ADMINISTRATIVO')
  director(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: PersonalPlantelDto,
    @CurrentUser() user: JwtUser,
  ) { return this.service.asignarDirector(id, dto.email, user); }

  @Post(':id/personal')
  @Roles('ADMINISTRATIVO')
  agregarPersonal(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: PersonalPlantelDto,
    @CurrentUser() user: JwtUser,
  ) { return this.service.agregarPersonal(id, dto.email, user); }

  @Delete(':id/personal/:usuarioId')
  @Roles('ADMINISTRATIVO')
  quitarPersonal(
    @Param('id', ParseIntPipe) id: number,
    @Param('usuarioId', ParseIntPipe) usuarioId: number,
    @CurrentUser() user: JwtUser,
  ) { return this.service.quitarPersonal(id, usuarioId, user); }
}
