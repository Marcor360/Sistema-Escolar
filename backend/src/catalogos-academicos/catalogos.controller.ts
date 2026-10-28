import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { CurrentUser, JwtUser } from '../common/current-user.decorator';
import { CatalogosAcademicosService } from './catalogos.service';
import { CrearNivelDto, CrearCarreraDto, CrearPeriodoDto, EditarCatalogoDto, EditarPeriodoDto, ListarCatalogosDto } from './catalogos.dto';
@ApiTags('catalogos-academicos') @ApiBearerAuth() @UseGuards(JwtAuthGuard, RolesGuard) @Roles('ADMINISTRATIVO')
@Controller('academico/catalogos')
export class CatalogosAcademicosController {
  constructor(private readonly service: CatalogosAcademicosService) {}
  @Get('niveles') @Roles('ADMINISTRATIVO', 'FINANZAS', 'MAESTRO')
  listarniveles(@Query() q: ListarCatalogosDto, @CurrentUser() u: JwtUser) { return this.service.listar('niveles', q, u); }
  @Get('niveles/:id') @Roles('ADMINISTRATIVO', 'FINANZAS', 'MAESTRO')
  obtenerniveles(@Param('id', ParseIntPipe) id: number, @CurrentUser() u: JwtUser) { return this.service.obtener('niveles', id, u); }
  @Post('niveles') crearniveles(@Body() d: CrearNivelDto, @CurrentUser() u: JwtUser) { return this.service.crear('niveles', d, u); }
  @Patch('niveles/:id') editarniveles(@Param('id', ParseIntPipe) id: number, @Body() d: EditarCatalogoDto, @CurrentUser() u: JwtUser) { return this.service.editar('niveles', id, d, u); }
  @Get('carreras') @Roles('ADMINISTRATIVO', 'FINANZAS', 'MAESTRO')
  listarcarreras(@Query() q: ListarCatalogosDto, @CurrentUser() u: JwtUser) { return this.service.listar('carreras', q, u); }
  @Get('carreras/:id') @Roles('ADMINISTRATIVO', 'FINANZAS', 'MAESTRO')
  obtenercarreras(@Param('id', ParseIntPipe) id: number, @CurrentUser() u: JwtUser) { return this.service.obtener('carreras', id, u); }
  @Post('carreras') crearcarreras(@Body() d: CrearCarreraDto, @CurrentUser() u: JwtUser) { return this.service.crear('carreras', d, u); }
  @Patch('carreras/:id') editarcarreras(@Param('id', ParseIntPipe) id: number, @Body() d: EditarCatalogoDto, @CurrentUser() u: JwtUser) { return this.service.editar('carreras', id, d, u); }
  @Get('periodos') @Roles('ADMINISTRATIVO', 'FINANZAS', 'MAESTRO')
  listarperiodos(@Query() q: ListarCatalogosDto, @CurrentUser() u: JwtUser) { return this.service.listar('periodos', q, u); }
  @Get('periodos/:id') @Roles('ADMINISTRATIVO', 'FINANZAS', 'MAESTRO')
  obtenerperiodos(@Param('id', ParseIntPipe) id: number, @CurrentUser() u: JwtUser) { return this.service.obtener('periodos', id, u); }
  @Post('periodos') crearperiodos(@Body() d: CrearPeriodoDto, @CurrentUser() u: JwtUser) { return this.service.crear('periodos', d, u); }
  @Patch('periodos/:id') editarperiodos(@Param('id', ParseIntPipe) id: number, @Body() d: EditarPeriodoDto, @CurrentUser() u: JwtUser) { return this.service.editar('periodos', id, d, u); }
}
