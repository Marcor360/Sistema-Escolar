import { BadRequestException, Body, Controller, Delete, Get, Header, Post, Put, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiPayloadTooLargeResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { Roles } from '../common/roles.decorator';
import { RolesGuard } from '../common/roles.guard';
import { ActualizarMarcaDto } from './configuracion.dto';
import { ConfiguracionService } from './configuracion.service';
import { LogoUploadErrorInterceptor } from './logo-upload-error.interceptor';
import { logoUploadConfig } from './logo-upload.config';

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

  @Delete('marca/logo')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPERADMIN')
  quitarLogo() {
    return this.service.quitarLogo();
  }
}
