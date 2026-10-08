import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type, Transform } from 'class-transformer';
import { IsDateString, IsIn, IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';
import { PaginacionDto } from '../common/paginacion.dto';
export class ListarIncidenciasDto extends PaginacionDto {
  @ApiPropertyOptional({ type: Number, minimum: 1 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) plantelId?: number;
  @ApiPropertyOptional({ type: Number, minimum: 1 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) cicloId?: number;
  @ApiPropertyOptional({ type: Number, minimum: 1 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) alumnoId?: number;
}
export class CrearIncidenciaDto {
  @ApiProperty({ type: Number, minimum: 1 })
  @IsInt() @Min(1) alumnoId!: number;
  @ApiProperty({ type: Number, minimum: 1 })
  @IsInt() @Min(1) grupoId!: number;
  @ApiProperty({ type: String })
  @IsString() @MinLength(1) @MaxLength(40) tipo!: string;
  @ApiProperty({ enum: ['LEVE','MEDIA','GRAVE'] })
  @IsIn(['LEVE', 'MEDIA', 'GRAVE']) gravedad!: string;
  @ApiProperty({ type: String })
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsString() @MinLength(3) @MaxLength(2000) descripcion!: string;
  @ApiProperty({ type: String, format: 'date' })
  @IsDateString({ strict: true }) fecha!: string;
}
export class SeguimientoIncidenciaDto {
  @ApiProperty({ type: String })
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsString() @MinLength(3) @MaxLength(2000) nota!: string;
  @ApiProperty({ type: String })
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsString() @MinLength(3) @MaxLength(500) motivo!: string;
  @ApiProperty({ enum: ['ABIERTA','EN_SEGUIMIENTO','CERRADA','ANULADA'] })
  @IsIn(['ABIERTA', 'EN_SEGUIMIENTO', 'CERRADA', 'ANULADA']) estado!: string;
}
