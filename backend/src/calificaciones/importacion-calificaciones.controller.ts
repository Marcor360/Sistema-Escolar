import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { CurrentUser, JwtUser } from '../common/current-user.decorator';
import { ContextoNotasDto, ConfirmarNotasDto } from './importacion-calificaciones.dto';
import { ImportacionCalificacionesService } from './importacion-calificaciones.service';
@Controller('importaciones/calificaciones')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('MAESTRO', 'ADMINISTRATIVO')
export class ImportacionCalificacionesController {
  constructor(private readonly service: ImportacionCalificacionesService) {}
  @Get('plantilla') async plantilla(
    @Query() dto: ContextoNotasDto,
    @CurrentUser() user: JwtUser,
    @Res() res: Response,
  ) {
    const archivo = await this.service.plantilla(dto, user);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="plantilla_calificaciones.xlsx"');
    res.send(archivo);
  }
  @Post('preview')
  @UseInterceptors(FileInterceptor('archivo', { limits: { fileSize: 5 * 1024 * 1024, files: 1 } }))
  preview(@Body() dto: ContextoNotasDto, @UploadedFile() archivo: Express.Multer.File, @CurrentUser() user: JwtUser) {
    if (!archivo?.buffer) throw new BadRequestException('Adjunta CSV o XLSX');
    return this.service.preview(dto, archivo.buffer, archivo.originalname, user);
  }
  @Post('confirmar') confirmar(@Body() dto: ConfirmarNotasDto, @CurrentUser() user: JwtUser) {
    return this.service.confirmar(dto.previewId, dto.confirmado, user);
  }
}
