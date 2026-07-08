import { Type } from 'class-transformer';
import { IsArray, IsInt, IsNumber, IsOptional, IsString, Max, Min, ValidateNested } from 'class-validator';

export class ItemCapturaDto {
  @IsInt() alumnoId: number;
  @IsNumber() @Min(0) @Max(100) calificacion: number;
  @IsOptional() @IsString() observaciones?: string;
}

export class CapturaCalificacionesDto {
  @IsInt() grupoMateriaId: number;
  @IsInt() @Min(0) @Max(3) parcial: number;
  @IsArray() @ValidateNested({ each: true }) @Type(() => ItemCapturaDto)
  items: ItemCapturaDto[];
}
