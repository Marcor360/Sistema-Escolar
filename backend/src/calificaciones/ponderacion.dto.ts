import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, ArrayUnique, IsArray, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min, MinLength, ValidateNested } from 'class-validator';
class CriterioDto {
  @IsString() @MinLength(1) @MaxLength(100) nombre!: string;
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) @Max(100) porcentaje!: number;
}
class NotaCriteriosDto {
  @IsInt() @Min(1) alumnoId!: number;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(20) @IsNumber({ maxDecimalPlaces: 2 }, { each: true }) @Min(0, { each: true }) @Max(10, { each: true }) notas!: number[];
}
export class CapturaPonderadaDto {
  @IsInt() @Min(1) grupoMateriaId!: number;
  @IsInt() @Min(1) @Max(4) parcial!: number;
  @IsOptional() @IsString() @MaxLength(300) motivo?: string;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(20) @ValidateNested({ each: true }) @Type(() => CriterioDto) criterios!: CriterioDto[];
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(500) @ArrayUnique((i: NotaCriteriosDto) => i?.alumnoId) @ValidateNested({ each: true }) @Type(() => NotaCriteriosDto) items!: NotaCriteriosDto[];
}
