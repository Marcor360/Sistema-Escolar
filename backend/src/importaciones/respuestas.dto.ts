import { ApiProperty } from '@nestjs/swagger';
export class ErrorFilaDto {
  @ApiProperty({ example: 2 }) fila!: number;
  @ApiProperty({ example: 'Correo ya registrado o duplicado en el archivo' }) mensaje!: string;
}
export class IdentificadorFilaDto {
  @ApiProperty() fila!: number;
  @ApiProperty() identificador!: string;
}
export class PreviewImportacionRespuestaDto {
  @ApiProperty({ type: String, format: 'uuid', nullable: true }) previewId!: string | null;
  @ApiProperty({ maximum: 500 }) registros!: number;
  @ApiProperty({ maximum: 500 }) validos!: number;
  @ApiProperty({ type: [ErrorFilaDto] }) duplicados!: ErrorFilaDto[];
  @ApiProperty({ type: [ErrorFilaDto] }) errores!: ErrorFilaDto[];
  @ApiProperty({ type: [IdentificadorFilaDto] }) identificadores!: IdentificadorFilaDto[];
  @ApiProperty({ description: 'Confirmación atómica y política de activación de cuentas' }) regla!: string;
}
export class ConfirmacionImportacionRespuestaDto {
  @ApiProperty({ maximum: 500 }) insertados!: number;
  @ApiProperty({ maximum: 500 }) total!: number;
  @ApiProperty({ maximum: 500 }) existentes!: number;
  @ApiProperty({ maximum: 500 }) rechazados!: number;
  @ApiProperty({ type: String, nullable: true }) activacion!: string | null;
}
