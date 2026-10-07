import { IsDateString, MaxLength, Min, MinLength as LongitudMinima } from 'class-validator';
import { Transform as Normalizar } from 'class-transformer';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString } from 'class-validator';
import { PaginacionDto } from '../common/paginacion.dto';

export class ListarGruposDto extends PaginacionDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) cicloId?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) plantelId?: number;
  @IsOptional() @Transform(({ value }) => value === true || value === 'true') @IsBoolean() inactivos?: boolean;
}

export class CicloDto {
  @Normalizar(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim().toUpperCase() : value)
  @IsString() @LongitudMinima(1) @MaxLength(20) clave: string;
  @Normalizar(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsString() @LongitudMinima(1) @MaxLength(80) nombre: string;
  @Normalizar(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsDateString({ strict: true }) fechaInicio: string; // YYYY-MM-DD
  @Normalizar(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsDateString({ strict: true }) fechaFin: string;
  @IsOptional() @IsBoolean() activo?: boolean;
}

export class ActualizarCicloDto {
  @Normalizar(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim().toUpperCase() : value)
  @IsOptional() @IsString() @LongitudMinima(1) @MaxLength(20) clave?: string;
  @Normalizar(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsOptional() @IsString() @LongitudMinima(1) @MaxLength(80) nombre?: string;
  @Normalizar(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsOptional() @IsDateString({ strict: true }) fechaInicio?: string;
  @Normalizar(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsOptional() @IsDateString({ strict: true }) fechaFin?: string;
  @IsOptional() @IsBoolean() activo?: boolean;
}

export class MateriaDto {
  @Normalizar(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim().toUpperCase() : value)
  @IsString() @LongitudMinima(1) @MaxLength(20) clave: string;
  @Normalizar(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsString() @LongitudMinima(1) @MaxLength(120) nombre: string;
  @Normalizar(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsOptional() @IsString() @MaxLength(300) descripcion?: string;
  @IsOptional() @IsInt() @Min(1) creditos?: number;
}

export class ActualizarMateriaDto {
  @Normalizar(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim().toUpperCase() : value)
  @IsOptional() @IsString() @LongitudMinima(1) @MaxLength(20) clave?: string;
  @Normalizar(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsOptional() @IsString() @LongitudMinima(1) @MaxLength(120) nombre?: string;
  @Normalizar(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsOptional() @IsString() @MaxLength(300) descripcion?: string;
  @IsOptional() @IsInt() @Min(1) creditos?: number;
}

export class GrupoDto {
  @Type(() => Number) @IsInt() @Min(1) cicloId: number;
  @Type(() => Number) @IsInt() @Min(1) plantelId: number;
  @Normalizar(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsString() @LongitudMinima(1) @MaxLength(40) nombre: string;
  @Normalizar(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsOptional() @IsString() @MaxLength(20) grado?: string;
  @IsOptional() @IsIn(['MATUTINO', 'VESPERTINO']) turno?: 'MATUTINO' | 'VESPERTINO';
}

export class ActualizarGrupoDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) cicloId?: number;
  @Normalizar(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsOptional() @IsString() @LongitudMinima(1) @MaxLength(40) nombre?: string;
  @Normalizar(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsOptional() @IsString() @MaxLength(20) grado?: string;
  @IsOptional() @IsIn(['MATUTINO', 'VESPERTINO']) turno?: 'MATUTINO' | 'VESPERTINO';
}

export class AsignarMateriaDto {
  @IsInt() @Min(1) materiaId: number;
  @IsOptional() @IsInt() @Min(1) docenteId?: number;
}

export class InscribirAlumnoDto {
  @IsInt() @Min(1) alumnoId: number;
}
