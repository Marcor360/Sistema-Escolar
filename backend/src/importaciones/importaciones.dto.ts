import { IsBoolean, IsIn, IsUUID } from 'class-validator';
export const TIPOS_IMPORTACION = ['ALUMNOS', 'DOCENTES', 'PERSONAL', 'INSCRIPCIONES'] as const;
export type TipoImportacion = typeof TIPOS_IMPORTACION[number];
export class TipoImportacionDto { @IsIn(TIPOS_IMPORTACION) tipo: TipoImportacion; }
export class ConfirmarImportacionDto { @IsUUID('4') previewId: string; @IsBoolean() confirmado: boolean; }
