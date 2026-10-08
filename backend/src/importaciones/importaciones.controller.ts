import { ApiBearerAuth, ApiTags, ApiOperation, ApiOkResponse, ApiCreatedResponse, ApiConsumes, ApiBody, ApiResponse } from '@nestjs/swagger';
import { ApiErroresOperacion } from '../common/api-operacion';
import { PreviewImportacionRespuestaDto, ConfirmacionImportacionRespuestaDto } from './respuestas.dto';
import { BadRequestException, Body, Controller, Get, Post, Query, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import * as ExcelJS from 'exceljs';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { CurrentUser, JwtUser } from '../common/current-user.decorator';
import { ConfirmarImportacionDto, TipoImportacionDto } from './importaciones.dto';
import { CABECERAS, ImportacionesService } from './importaciones.service';
@ApiTags('importaciones') @ApiBearerAuth() @ApiErroresOperacion()
@UseGuards(JwtAuthGuard, RolesGuard) @Roles('ADMINISTRATIVO') @Controller('importaciones')
export class ImportacionesController {
  constructor(private readonly service: ImportacionesService) {}
  @ApiOperation({ summary: 'Plantilla XLSX por tipo; personal reservado a Superadmin al confirmar' })
  @ApiOkResponse({ content: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': { schema: { type: 'string', format: 'binary' } } } })
  @Get('plantilla') async plantilla(@Query() dto: TipoImportacionDto, @Res() res: Response) {
    const libro = new ExcelJS.Workbook(); const hoja = libro.addWorksheet(dto.tipo); hoja.addRow(CABECERAS[dto.tipo]); hoja.getRow(1).font = { bold: true }; hoja.columns.forEach((c) => { c.width = 22; });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'); res.setHeader('Content-Disposition', `attachment; filename="plantilla_${dto.tipo.toLowerCase()}.xlsx"`);
    res.send(Buffer.from(await libro.xlsx.writeBuffer()));
  }
  @ApiOperation({ summary: 'Validar hasta 500 filas sin importarlas; preview cifrado del actor válido 15 minutos' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', required: ['tipo','archivo'], properties: { tipo: { type: 'string', enum: ['ALUMNOS','DOCENTES','PERSONAL','INSCRIPCIONES'] }, archivo: { type: 'string', format: 'binary', description: 'CSV/XLSX hasta 5 MB, sin fórmulas' } } } })
  @ApiResponse({ status: 413, description: 'Archivo mayor que 5 MB' })
  @ApiCreatedResponse({ type: PreviewImportacionRespuestaDto })
  @Post('preview') @UseInterceptors(FileInterceptor('archivo', { limits: { fileSize: 5 * 1024 * 1024, files: 1 } }))
  preview(@Body() dto: TipoImportacionDto, @UploadedFile() archivo: Express.Multer.File, @CurrentUser() user: JwtUser) {
    if (!archivo?.buffer) throw new BadRequestException('Adjunta CSV o XLSX'); return this.service.preview(dto.tipo, archivo.buffer, archivo.originalname, user);
  }
  @ApiOperation({ summary: 'Consumir preview del actor y confirmar lote atómicamente; revalida alcance y duplicados' })
  @ApiCreatedResponse({ type: ConfirmacionImportacionRespuestaDto })
  @Post('confirmar') confirmar(@Body() dto: ConfirmarImportacionDto, @CurrentUser() user: JwtUser) { return this.service.confirmar(dto.previewId, dto.confirmado, user); }
}
