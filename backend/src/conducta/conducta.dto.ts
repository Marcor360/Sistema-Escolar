import { Type, Transform } from 'class-transformer';
import { IsDateString, IsIn, IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';
import { PaginacionDto } from '../common/paginacion.dto';
export class ListarIncidenciasDto extends PaginacionDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) plantelId?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) cicloId?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) alumnoId?: number;
}
export class CrearIncidenciaDto {
  @IsInt() @Min(1) alumnoId: number;
  @IsInt() @Min(1) grupoId: number;
  @IsString() @MinLength(1) @MaxLength(40) tipo: string;
  @IsIn(['LEVE', 'MEDIA', 'GRAVE']) gravedad: string;
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsString() @MinLength(3) @MaxLength(2000) descripcion: string;
  @IsDateString({ strict: true }) fecha: string;
}
export class SeguimientoIncidenciaDto {
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsString() @MinLength(3) @MaxLength(2000) nota: string;
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsString() @MinLength(3) @MaxLength(500) motivo: string;
  @IsIn(['ABIERTA', 'EN_SEGUIMIENTO', 'CERRADA', 'ANULADA']) estado: string;
}
