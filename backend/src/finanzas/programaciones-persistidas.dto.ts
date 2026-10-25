import { Equals, IsInt, IsOptional, IsUUID, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PrevisualizarProgramacionDto } from './programaciones.dto';
export interface CuotaProgramada {
  numero: number;
  periodo: string;
  fechaVencimiento: string;
  monto: number;
  etiqueta: string;
  periodoAcademicoId: number;
  cargoId: number | null;
}

export class ConfirmarProgramacionDto extends PrevisualizarProgramacionDto {
  @ApiProperty() @IsInt() @Min(1) alumnoId!: number;
  @ApiProperty() @IsInt() @Min(1) plantelId!: number;
  @ApiProperty() @IsInt() @Min(1) cicloId!: number;
  @ApiProperty() @IsInt() @Min(1) periodoAcademicoId!: number;
  @ApiProperty() @IsInt() @Min(1) conceptoId!: number;
  @ApiPropertyOptional({ description: 'Segundo periodo SEMESTRAL del mismo ciclo, mismo plan y número consecutivo' })
  @IsOptional() @IsInt() @Min(1) segundoPeriodoAcademicoId?: number;
  @ApiProperty() @IsUUID('4') idempotencia!: string;
  @ApiProperty() @Equals(true) confirmado!: true;
}

export class EmitirCuotaDto {
  @ApiProperty({ description: 'Confirmación explícita; emite un cargo nuevo, no registra pago' })
  @Equals(true) confirmado!: true;
}
