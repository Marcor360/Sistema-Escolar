import { Type } from 'class-transformer';
import { ArrayNotEmpty, ArrayUnique, IsArray, IsIn, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min, ValidateNested } from 'class-validator';

export class ItemCapturaDto {
  @IsInt() alumnoId: number;
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(100) calificacion: number;
  @IsOptional() @IsString() @MaxLength(300) observaciones?: string;
}

export class CapturaCalificacionesDto {
  @IsInt() grupoMateriaId: number;
  @IsInt() @Min(0) @Max(3) parcial: number;
  @IsOptional() @IsString() @MaxLength(300) motivo?: string;
  @IsArray() @ArrayNotEmpty() @ArrayUnique((item: ItemCapturaDto) => item.alumnoId)
  @ValidateNested({ each: true }) @Type(() => ItemCapturaDto)
  items: ItemCapturaDto[];
}

export class CambiarEstadoPeriodoDto {
  @IsIn(['ABIERTO', 'CERRADO']) estatus: 'ABIERTO' | 'CERRADO';
}
