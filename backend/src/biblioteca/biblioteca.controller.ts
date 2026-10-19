import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser, JwtUser } from '../common/current-user.decorator';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { BibliotecaService } from './biblioteca.service';
import { ConsultaBibliotecaDto, CrearCarpetaDto, SubirBibliotecaDto } from './biblioteca.dto';
@Controller('biblioteca')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMINISTRATIVO')
export class BibliotecaController {
  constructor(private readonly service: BibliotecaService) {}
  @Get() listar(@Query() dto: ConsultaBibliotecaDto, @CurrentUser() user: JwtUser) {
    return this.service.listar(dto, user);
  }
  @Get('carpetas') carpetas(@Query() dto: ConsultaBibliotecaDto, @CurrentUser() user: JwtUser) { return this.service.carpetas(dto.plantelId,user); }
  @Post('carpetas') crear(@Body() dto: CrearCarpetaDto, @CurrentUser() user: JwtUser) {
    return this.service.crear(dto, user);
  }
  @Post('archivos')
  @UseInterceptors(FileInterceptor('archivo', { limits: { fileSize: 10 * 1024 * 1024, files: 1 } }))
  subir(@Body() dto: SubirBibliotecaDto, @UploadedFile() archivo: Express.Multer.File, @CurrentUser() user: JwtUser) {
    return this.service.subir(dto, archivo, user);
  }
  @Delete('archivos/:id') eliminar(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) {
    return this.service.eliminar(id, user);
  }
}
