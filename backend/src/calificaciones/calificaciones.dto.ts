import { Type } from 'class-transformer';
import { ArrayNotEmpty, ArrayUnique, IsArray, IsIn, IsInt, IsNumber, IsOptional, Matches, IsString, Max, MaxLength, Min, ValidateNested } from 'class-validator';

export class ItemCapturaDto {
  @IsInt() alumnoId!: number;
  @IsNumber({ maxDecimalPlaces: 8 }) @Min(0) @Max(100) calificacion!: number;
  @IsOptional() @IsString() @MaxLength(300) observaciones?: string | null;
}

export class CapturaCalificacionesDto {
  @IsOptional() @IsIn([10, 100]) escalaMaxima?: number;
  @IsInt() grupoMateriaId!: number;
  @IsInt() @Min(0) @Max(4) parcial!: number;
  @IsOptional() @IsString() @MaxLength(300) motivo?: string;
  @IsArray() @ArrayNotEmpty() @ArrayUnique((item: ItemCapturaDto) => item?.alumnoId)
  @ValidateNested({ each: true }) @Type(() => ItemCapturaDto)
  items!: ItemCapturaDto[];
}

export class CambiarEstadoPeriodoDto {
  @IsIn(['ABIERTO', 'CERRADO']) estatus!: 'ABIERTO' | 'CERRADO';
}

export class AprobarFinalDto {
  @IsInt() @Min(1) grupoMateriaId!: number;
  @IsInt() @Min(1) alumnoId!: number;
  @IsString() @Matches(/^[a-f0-9]{64}$/) revision!: string;
  @IsOptional() @IsString() @MaxLength(300) motivo?: string;
}
