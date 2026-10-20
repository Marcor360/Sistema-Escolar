import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { CurrentUser, JwtUser } from '../common/current-user.decorator';
import { uploadConfig } from '../common/upload.config';
import { LimpiezaUploadInterceptor } from '../common/limpieza-upload.interceptor';
import { TemariosService } from './temarios.service';
import { CancelarTemaDto, ConsultarTemasDto, CrearTemaDto, EditarTemaDto, RevisionTemaDto } from './temarios.dto';
@ApiTags('temarios') @ApiBearerAuth() @UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class TemariosController {
  constructor(private readonly service: TemariosService) {}
  @Get('grupo-materias/:id/temario') @Roles('ADMINISTRATIVO', 'MAESTRO', 'ALUMNO')
  listar(@Param('id', ParseIntPipe) id: number, @Query() q: ConsultarTemasDto, @CurrentUser() u: JwtUser) { return this.service.listar(id, q, u); }
  @Get('temarios/:id/historial') @Roles('ADMINISTRATIVO', 'MAESTRO')
  historial(@Param('id', ParseIntPipe) id: number, @Query() q: ConsultarTemasDto, @CurrentUser() u: JwtUser) { return this.service.historial(id, q, u); }
  @Get('temarios/:id') @Roles('ADMINISTRATIVO', 'MAESTRO', 'ALUMNO')
  obtener(@Param('id', ParseIntPipe) id: number, @CurrentUser() u: JwtUser) { return this.service.obtener(id, u); }
  @Post('temarios') @Roles('ADMINISTRATIVO', 'MAESTRO')
  crear(@Body() dto: CrearTemaDto, @CurrentUser() u: JwtUser) { return this.service.crear(dto, u); }
  @Patch('temarios/:id') @Roles('ADMINISTRATIVO', 'MAESTRO')
  editar(@Param('id', ParseIntPipe) id: number, @Body() dto: EditarTemaDto, @CurrentUser() u: JwtUser) { return this.service.editar(id, dto, u); }
  @Post('temarios/:id/cancelar') @Roles('ADMINISTRATIVO', 'MAESTRO')
  cancelar(@Param('id', ParseIntPipe) id: number, @Body() dto: CancelarTemaDto, @CurrentUser() u: JwtUser) { return this.service.cancelar(id, dto, u); }
  @Post('temarios/:id/adjuntos') @Roles('ADMINISTRATIVO', 'MAESTRO') @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('archivo', uploadConfig), LimpiezaUploadInterceptor)
  adjuntar(@Param('id', ParseIntPipe) id: number, @Body() dto: RevisionTemaDto, @UploadedFile() a: Express.Multer.File, @CurrentUser() u: JwtUser) { return this.service.adjuntar(id, dto.revision, a, u); }
  @Delete('temarios/:id/adjuntos/:adjuntoId') @Roles('ADMINISTRATIVO', 'MAESTRO')
  retirar(@Param('id', ParseIntPipe) id: number, @Param('adjuntoId', ParseIntPipe) adjuntoId: number, @Body() dto: RevisionTemaDto, @CurrentUser() u: JwtUser) { return this.service.retirar(id, adjuntoId, dto.revision, u); }
}
