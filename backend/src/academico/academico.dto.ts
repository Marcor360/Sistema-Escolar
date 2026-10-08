import { OpcionalNoNulo } from '../common/opcional-no-nulo';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Matches, IsDateString, MaxLength, Min, MinLength as LongitudMinima } from 'class-validator';
import { Transform as Normalizar } from 'class-transformer';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString } from 'class-validator';
import { PaginacionDto } from '../common/paginacion.dto';

export class ListarGruposDto extends PaginacionDto {
  @ApiPropertyOptional({ type: String })
  @Normalizar(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsOptional() @IsString() @MaxLength(80) buscar?: string;
  @ApiPropertyOptional({ type: Number, minimum: 1 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) cicloId?: number;
  @ApiPropertyOptional({ type: Number, minimum: 1 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) plantelId?: number;
  @ApiPropertyOptional({ type: Boolean })
  @IsOptional() @Transform(({ value }) => value === true || value === 'true') @IsBoolean() inactivos?: boolean;
}

export class CicloDto {
  @ApiProperty({ type: String })
  @Normalizar(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim().toUpperCase() : value)
  @IsString() @LongitudMinima(1) @MaxLength(20) clave!: string;
  @ApiProperty({ type: String })
  @Normalizar(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsString() @LongitudMinima(1) @MaxLength(80) nombre!: string;
  @ApiProperty({ type: String, format: 'date' })
  @Normalizar(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @Matches(/^\d{4}-\d{2}-\d{2}$/) @IsDateString({ strict: true }) fechaInicio!: string; // YYYY-MM-DD
  @ApiProperty({ type: String, format: 'date' })
  @Normalizar(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @Matches(/^\d{4}-\d{2}-\d{2}$/) @IsDateString({ strict: true }) fechaFin!: string;
  @ApiPropertyOptional({ type: Boolean })
  @OpcionalNoNulo() @IsBoolean() activo?: boolean;
}

export class ActualizarCicloDto {
  @ApiPropertyOptional({ type: String })
  @Normalizar(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim().toUpperCase() : value)
  @OpcionalNoNulo() @IsString() @LongitudMinima(1) @MaxLength(20) clave?: string;
  @ApiPropertyOptional({ type: String })
  @Normalizar(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @OpcionalNoNulo() @IsString() @LongitudMinima(1) @MaxLength(80) nombre?: string;
  @ApiPropertyOptional({ type: String, format: 'date' })
  @Normalizar(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @OpcionalNoNulo() @Matches(/^\d{4}-\d{2}-\d{2}$/) @IsDateString({ strict: true }) fechaInicio?: string;
  @ApiPropertyOptional({ type: String, format: 'date' })
  @Normalizar(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @OpcionalNoNulo() @Matches(/^\d{4}-\d{2}-\d{2}$/) @IsDateString({ strict: true }) fechaFin?: string;
  @ApiPropertyOptional({ type: Boolean })
  @OpcionalNoNulo() @IsBoolean() activo?: boolean;
}

export class MateriaDto {
  @ApiProperty({ type: String })
  @Normalizar(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim().toUpperCase() : value)
  @IsString() @LongitudMinima(1) @MaxLength(20) clave!: string;
  @ApiProperty({ type: String })
  @Normalizar(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsString() @LongitudMinima(1) @MaxLength(120) nombre!: string;
  @ApiPropertyOptional({ type: String })
  @Normalizar(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsOptional() @IsString() @MaxLength(300) descripcion?: string;
  @ApiPropertyOptional({ type: Number, minimum: 0 })
  @OpcionalNoNulo() @IsInt() @Min(0) creditos?: number;
}

export class ActualizarMateriaDto {
  @ApiPropertyOptional({ type: String })
  @Normalizar(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim().toUpperCase() : value)
  @OpcionalNoNulo() @IsString() @LongitudMinima(1) @MaxLength(20) clave?: string;
  @ApiPropertyOptional({ type: String })
  @Normalizar(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @OpcionalNoNulo() @IsString() @LongitudMinima(1) @MaxLength(120) nombre?: string;
  @ApiPropertyOptional({ type: String })
  @Normalizar(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsOptional() @IsString() @MaxLength(300) descripcion?: string;
  @ApiPropertyOptional({ type: Number, minimum: 0 })
  @OpcionalNoNulo() @IsInt() @Min(0) creditos?: number;
}

export class GrupoDto {
  @ApiProperty({ type: Number, minimum: 1 })
  @Type(() => Number) @IsInt() @Min(1) cicloId!: number;
  @ApiProperty({ type: Number, minimum: 1 })
  @Type(() => Number) @IsInt() @Min(1) plantelId!: number;
  @ApiProperty({ type: String })
  @Normalizar(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsString() @LongitudMinima(1) @MaxLength(40) nombre!: string;
  @ApiPropertyOptional({ type: String })
  @Normalizar(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsOptional() @IsString() @MaxLength(20) grado?: string;
  @ApiPropertyOptional({ enum: ['MATUTINO','VESPERTINO'] })
  @IsOptional() @IsIn(['MATUTINO', 'VESPERTINO']) turno?: 'MATUTINO' | 'VESPERTINO';
}

export class ActualizarGrupoDto {
  @ApiPropertyOptional({ type: Number, minimum: 1 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) cicloId?: number;
  @ApiPropertyOptional({ type: String })
  @Normalizar(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @OpcionalNoNulo() @IsString() @LongitudMinima(1) @MaxLength(40) nombre?: string;
  @ApiPropertyOptional({ type: String })
  @Normalizar(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsOptional() @IsString() @MaxLength(20) grado?: string;
  @ApiPropertyOptional({ enum: ['MATUTINO','VESPERTINO'] })
  @IsOptional() @IsIn(['MATUTINO', 'VESPERTINO']) turno?: 'MATUTINO' | 'VESPERTINO';
}

export class AsignarMateriaDto {
  @ApiProperty({ type: Number, minimum: 1 })
  @IsInt() @Min(1) materiaId!: number;
  @ApiPropertyOptional({ type: Number, minimum: 1 })
  @IsOptional() @IsInt() @Min(1) docenteId?: number;
}

export class InscribirAlumnoDto {
  @ApiProperty({ type: Number, minimum: 1 })
  @IsInt() @Min(1) alumnoId!: number;
}

export class TransicionCicloDto {
  @ApiProperty({ type: Boolean, description: 'Debe ser true para ejecutar la operación' })
  @IsBoolean() confirmado!: boolean;
}
