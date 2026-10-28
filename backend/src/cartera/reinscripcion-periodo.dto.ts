import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  Equals,
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { PrevisualizarReinscripcionDto } from './cartera.dto';
export class CuotaPeriodoDto {
  @IsInt() @Min(1) conceptoId!: number;
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/) periodo!: string;
  @IsDateString({ strict: true }) fechaVencimiento!: string;
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) @Max(9999999999.99) monto!: number;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(9999999999.99) descuento?: number;
}
export class ReinscripcionPeriodoDto extends PrevisualizarReinscripcionDto {
  @IsOptional() @IsIn(['ORDINARIA', 'CONDICIONAL']) condicion?: 'ORDINARIA' | 'CONDICIONAL';
  @IsOptional() @IsString() @MinLength(5) @MaxLength(200) documentoRef?: string;
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(60)
  @ValidateNested({ each: true })
  @Type(() => CuotaPeriodoDto)
  parcialidades?: CuotaPeriodoDto[];
}
export class AutorizarReinscripcionDto extends ReinscripcionPeriodoDto {
  @Matches(/^[a-f0-9]{64}$/) cotizacion!: string;
}
export class ConfirmarPeriodoDto {
  @IsInt() @Min(1) autorizacionId!: number;
  @IsUUID() idempotencia!: string;
  @Matches(/^[a-f0-9]{64}$/) cotizacion!: string;
  @Equals(true) confirmado!: boolean;
}
export class AnularReinscripcionDto {
  @IsString() @MinLength(10) @MaxLength(300) motivo!: string;
  @Equals(true) confirmado!: boolean;
}
