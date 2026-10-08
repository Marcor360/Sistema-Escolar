import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';
export class AnaliticaDto {
  @ApiPropertyOptional({ type: Number, minimum: 1 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) cicloId?: number;
  @ApiPropertyOptional({ type: Number, minimum: 1 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) plantelId?: number;
  @ApiPropertyOptional({ type: Number, minimum: 1 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) grupoId?: number;
  @ApiPropertyOptional({ type: Number, minimum: 1 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) materiaId?: number;
}
