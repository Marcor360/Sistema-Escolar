import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsInt,
  IsNumber,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
export class MovimientoDto {
  @IsString() @MinLength(1) @MaxLength(60) folio!: string;
  @IsString() @MaxLength(60) referencia!: string;
  @IsDateString({ strict: true }) @Matches(/^\d{4}-\d{2}-\d{2}$/) fecha!: string;
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) @Max(9999999999.99) monto!: number;
}
export class ImportarBancoDto {
  @IsInt() @Min(1) plantelId!: number;
  @IsString() @Matches(/^[A-Za-z0-9_-]{1,40}$/) cuenta!: string;
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => MovimientoDto)
  movimientos!: MovimientoDto[];
}
export class AplicarMovimientoDto {
  @IsInt() @Min(1) cargoId!: number;
}
