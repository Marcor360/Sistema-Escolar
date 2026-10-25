import { BadRequestException, Body, Controller, Delete, Get, Header, Post, Put, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiPayloadTooLargeResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { Roles } from '../common/roles.decorator';
import { RolesGuard } from '../common/roles.guard';
import { ActualizarMarcaDto, ActualizarOpcionesGlobalesDto } from './configuracion.dto';
import { ConfiguracionService } from './configuracion.service';
import { LogoUploadErrorInterceptor } from './logo-upload-error.interceptor';
import { logoUploadConfig } from './logo-upload.config';
import { logoPdfUploadConfig } from './logo-pdf-upload.config';

@ApiTags('configuracion')
@Controller('configuracion')
export class ConfiguracionController {
  constructor(private readonly service: ConfiguracionService) {}

  @Get('marca')
  @Header('Cache-Control', 'no-store')
  obtenerMarca() {
    return this.service.obtener();
  }

  @Put('marca')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPERADMIN')
  actualizarMarca(@Body() dto: ActualizarMarcaDto) {
    return this.service.actualizar(dto);
  }

  @Put('opciones')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cambiar opciones globales de presentación web (solo SUPERADMIN)' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPERADMIN')
  actualizarOpciones(@Body() dto: ActualizarOpcionesGlobalesDto) {
    return this.service.actualizarOpciones(dto);
  }
  @Post('marca/logo')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPERADMIN')
  @ApiConsumes('multipart/form-data')
  @ApiPayloadTooLargeResponse({ description: 'El WebP optimizado supera los 10 MiB (10,485,760 bytes) permitidos' })
  @UseInterceptors(LogoUploadErrorInterceptor, FileInterceptor('logo', logoUploadConfig))
  guardarLogo(@UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('Debes seleccionar un logo válido');
    return this.service.guardarLogo(file);
  }

  @Post('marca/logo/pdf')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Registrar variante PNG segura del logo institucional para fichas imprimibles, exclusivamente SUPERADMIN' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPERADMIN')
  @ApiConsumes('multipart/form-data')
  @ApiPayloadTooLargeResponse({ description: 'El logo PNG supera los 3 MiB permitidos' })
  @UseInterceptors(LogoUploadErrorInterceptor, FileInterceptor('logoPdf', logoPdfUploadConfig))
  guardarLogoPdf(@UploadedFile() file?: Express.Multer.File, @Body('logoUrl') logoUrl?: string) {
    if (!file) throw new BadRequestException('Debes seleccionar el logo PNG imprimible');
    return this.service.guardarLogoPdf(file, logoUrl);
  }

  @Delete('marca/logo')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPERADMIN')
  quitarLogo() {
    return this.service.quitarLogo();
  }
}
