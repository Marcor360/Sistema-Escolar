import { CalendarioUploadInterceptor } from './calendario-upload.interceptor';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { randomUUID } from 'crypto';
import { extname } from 'path';
import { BadRequestException } from '@nestjs/common';
import { uploadsPath } from '../common/uploads-path';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { CurrentUser, JwtUser } from '../common/current-user.decorator';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { Roles } from '../common/roles.decorator';
import { RolesGuard } from '../common/roles.guard';
import { CalendarioService } from './calendario.service';
import { EventoDto, EditarEventoDto, ConsultarEventosDto, ImportarCalendarioDto, GuardarMarcadorDto } from './calendario.dto';

const ImagenInterceptor = FileInterceptor('imagen', {
  storage: diskStorage({
    destination: (_r, _f, cb) => cb(null, uploadsPath()),
    filename: (_r, f, cb) => cb(null, 'calendario-' + randomUUID() + extname(f.originalname).toLowerCase()),
  }),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (_r, f, cb) =>
    cb(
      ['.png', '.jpg', '.jpeg', '.webp'].includes(extname(f.originalname).toLowerCase())
        ? null
        : new BadRequestException('Usa PNG, JPG o WebP'),
      true,
    ),
});

@ApiTags('calendario')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('calendario')
export class CalendarioController {
  constructor(private readonly service: CalendarioService) {}

  @Get('marcadores')
  @Roles('ALUMNO', 'MAESTRO', 'ADMINISTRATIVO', 'FINANZAS')
  marcadores(@CurrentUser() u: JwtUser, @Query('plantelId', new ParseIntPipe({ optional: true })) plantelId?: number) {
    return this.service.marcadores(u, plantelId);
  }
  @Post('marcadores')
  @Roles('ADMINISTRATIVO', 'FINANZAS')
  guardarMarcador(@Body() dto: GuardarMarcadorDto, @CurrentUser() u: JwtUser) {
    return this.service.guardarMarcador(dto, u);
  }
  @Post('ics/preview')
  @Roles('ADMINISTRATIVO', 'FINANZAS')
  previewIcs(@Body() dto: ImportarCalendarioDto, @CurrentUser() u: JwtUser) {
    return this.service.importarIcs(dto, u);
  }
  @Post('ics')
  @Roles('ADMINISTRATIVO', 'FINANZAS')
  importarIcs(@Body() dto: ImportarCalendarioDto, @CurrentUser() u: JwtUser) {
    return this.service.importarIcs(dto, u, true);
  }
  @Get(':id/historial')
  @Roles('ADMINISTRATIVO', 'FINANZAS', 'MAESTRO')
  historial(@Param('id', ParseIntPipe) id: number, @CurrentUser() u: JwtUser) {
    return this.service.historial(id, u);
  }
  @Get('opciones')
  @Roles('ALUMNO', 'MAESTRO', 'ADMINISTRATIVO', 'FINANZAS')
  opciones(@CurrentUser() user: JwtUser) {
    return this.service.opciones(user);
  }
  @Post('imagen')
  @Roles('ADMINISTRATIVO', 'FINANZAS')
  @UseInterceptors(CalendarioUploadInterceptor, ImagenInterceptor)
  imagenNueva(@Body() dto: EventoDto, @UploadedFile() file: Express.Multer.File, @CurrentUser() user: JwtUser) {
    if (!file) throw new BadRequestException('Selecciona una imagen');
    return this.service.crearImagen(dto, file, user);
  }
  @Post(':id/imagen')
  @Roles('ADMINISTRATIVO', 'FINANZAS')
  @UseInterceptors(CalendarioUploadInterceptor, ImagenInterceptor)
  reemplazar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: EditarEventoDto,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: JwtUser,
  ) {
    if (!file) throw new BadRequestException('Selecciona una imagen');
    return this.service.reemplazarImagen(id, dto, file, user);
  }
  @Get('listado')
  @Roles('ALUMNO', 'MAESTRO', 'ADMINISTRATIVO', 'FINANZAS')
  consultar(@Query() q: ConsultarEventosDto, @CurrentUser() user: JwtUser) {
    return this.service.consultar(q, user);
  }
  @Get(':id')
  @Roles('MAESTRO', 'ADMINISTRATIVO', 'FINANZAS')
  paraEditar(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) {
    return this.service.paraEditar(id, user);
  }

  @Get()
  @Roles('ALUMNO', 'MAESTRO', 'ADMINISTRATIVO', 'FINANZAS')
  listar(
    @CurrentUser() user: JwtUser,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
    @Query('plantelId', new ParseIntPipe({ optional: true })) plantelId?: number,
    @Query('cicloId', new ParseIntPipe({ optional: true })) cicloId?: number,
    @Query('nivelId', new ParseIntPipe({ optional: true })) nivelId?: number,
  ) {
    return this.service.listar(user, desde, hasta, plantelId, cicloId, nivelId);
  }

  @Post()
  @Roles('ADMINISTRATIVO', 'FINANZAS', 'MAESTRO')
  crear(@Body() dto: EventoDto, @CurrentUser() user: JwtUser) {
    return this.service.crear(dto, user);
  }

  @ApiOperation({ summary: 'Editar evento con revisión optimista y permisos de origen y destino' })
  @Patch(':id')
  @Roles('ADMINISTRATIVO', 'FINANZAS', 'MAESTRO')
  editar(@Param('id', ParseIntPipe) id: number, @Body() dto: EditarEventoDto, @CurrentUser() user: JwtUser) {
    return this.service.editar(id, dto, user);
  }

  @Delete(':id')
  @Roles('ADMINISTRATIVO', 'FINANZAS', 'MAESTRO')
  eliminar(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) {
    return this.service.eliminar(id, user);
  }
}
