import { Type, Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ValidateNested, IsNumber, Max, MinLength, ArrayMaxSize, ArrayMinSize, ArrayUnique, Equals, IsArray, IsDateString, IsIn, IsInt, IsOptional, IsString, IsUUID, Matches, MaxLength, Min } from 'class-validator';
import { PaginacionDto } from '../common/paginacion.dto';
export class PrevisualizarCarteraDto {
  @IsInt() @Min(1) alumnoId!: number;
  @IsInt() @Min(1) plantelId!: number;
  @IsInt() @Min(1) cicloId!: number;
  @IsInt() @Min(1) nivelId!: number;
  @IsInt() @Min(1) carreraId!: number;
  @IsInt() @Min(1) periodoAcademicoId!: number;
  @IsIn(['MATUTINO','VESPERTINO']) turno!: 'MATUTINO' | 'VESPERTINO';
  @IsOptional() @IsInt() @Min(1) grupoId?: number;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(20) @ArrayUnique() @IsInt({ each: true }) @Min(1, { each: true }) conceptoIds!: number[];
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/) periodo!: string;
  @IsDateString({ strict: true }) fechaVencimiento!: string;
}
export class ConfirmarCarteraDto extends PrevisualizarCarteraDto {
  @IsUUID() idempotencia!: string;
  @Matches(/^[a-f0-9]{64}$/) cotizacion!: string;
  @Equals(true) confirmado!: boolean;
}
export class ListarCarteraDto extends PaginacionDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) plantelId?: number;
  @IsOptional() @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value) @IsString() @MaxLength(100) buscar?: string;
}

export class AjusteColegiaturaDto {
  @ApiProperty() @IsInt() @Min(1) conceptoId!: number;
  @ApiProperty({ description: 'Tarifa personalizada para el nuevo periodo; no modifica cargos históricos' })
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) @Max(9999999999.99) monto!: number;
  @ApiProperty() @IsString() @MinLength(10) @MaxLength(250) motivo!: string;
}
export class PrevisualizarReinscripcionDto extends PrevisualizarCarteraDto {
  @ApiProperty() @IsInt() @Min(1) origenInscripcionId!: number;
  @ApiPropertyOptional({ description: 'Obligatorio al retroceder, repetir o saltar un periodo' })
  @IsOptional() @IsString() @MinLength(10) @MaxLength(500) motivo?: string;
  @ApiPropertyOptional({ type: [AjusteColegiaturaDto] })
  @IsOptional() @IsArray() @ArrayUnique((a: AjusteColegiaturaDto) => a.conceptoId)
  @ValidateNested({ each: true }) @Type(() => AjusteColegiaturaDto) ajustes?: AjusteColegiaturaDto[];
}
export class ConfirmarReinscripcionDto extends PrevisualizarReinscripcionDto {
  @ApiProperty() @IsUUID() idempotencia!: string;
  @ApiProperty() @Matches(/^[a-f0-9]{64}$/) cotizacion!: string;
  @ApiProperty() @Equals(true) confirmado!: boolean;
}
