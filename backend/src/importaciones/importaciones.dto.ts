import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsUUID } from 'class-validator';
export const TIPOS_IMPORTACION = ['ALUMNOS', 'DOCENTES', 'PERSONAL', 'INSCRIPCIONES'] as const;
export type TipoImportacion = typeof TIPOS_IMPORTACION[number];
export class TipoImportacionDto { @ApiProperty({ enum: TIPOS_IMPORTACION })
  @IsIn(TIPOS_IMPORTACION) tipo!: TipoImportacion; }
export class ConfirmarImportacionDto { @ApiProperty({ type: String, format: 'uuid' })
  @IsUUID('4') previewId!: string; @ApiProperty({ type: Boolean, description: 'Debe ser true para ejecutar la operación' })
  @IsBoolean() confirmado!: boolean; }
