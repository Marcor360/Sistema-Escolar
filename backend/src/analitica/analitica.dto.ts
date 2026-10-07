import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';
export class AnaliticaDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) cicloId?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) plantelId?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) grupoId?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) materiaId?: number;
}
