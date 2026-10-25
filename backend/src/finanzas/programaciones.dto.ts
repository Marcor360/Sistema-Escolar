import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsIn, IsInt, IsNumber, IsOptional, Matches, Max, Min, ValidateIf } from 'class-validator';

export type ModalidadFinanciera = 'SECUNDARIA' | 'BACHILLERATO' | 'SUPERIOR' | 'ADICIONAL';

export class PrevisualizarProgramacionDto {
  @ApiProperty({ enum: ['SECUNDARIA', 'BACHILLERATO', 'SUPERIOR', 'ADICIONAL'] })
  @IsIn(['SECUNDARIA', 'BACHILLERATO', 'SUPERIOR', 'ADICIONAL'])
  modalidad!: ModalidadFinanciera;

  @ApiProperty({ description: 'Total del año, cuatrimestre o servicio, según modalidad, en MXN' })
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) @Max(9999999999.99)
  total!: number;

  @ApiProperty({ example: '2027-01', description: 'Mes de la primera cuota (AAAA-MM)' })
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/)
  mesInicio!: string;

  @ApiProperty({ minimum: 1, maximum: 28 })
  @IsInt() @Min(1) @Max(28)
  diaVencimiento!: number;

  @ApiPropertyOptional({ description: 'Número de cuotas solo para concepto ADICIONAL: 1 a 12' })
  @ValidateIf((o: PrevisualizarProgramacionDto) => o.modalidad === 'ADICIONAL' || o.numeroCuotas !== undefined)
  @IsInt() @Min(1) @Max(12)
  numeroCuotas?: number;

  @ApiPropertyOptional({ type: [Number], description: 'Importes separados para BACHILLERATO o ADICIONAL; deben sumar el total exacto' })
  @IsOptional() @IsArray() @ArrayMaxSize(12)
  @IsNumber({ maxDecimalPlaces: 2 }, { each: true }) @Min(0.01, { each: true })
  importes?: number[];
}
