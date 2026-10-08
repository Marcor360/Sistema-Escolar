import { OpcionalNoNulo } from '../common/opcional-no-nulo';
import { MaxLength, Min, MinLength as LongitudMinima } from 'class-validator';
import { Transform as Normalizar } from 'class-transformer';
import { ArrayNotEmpty, IsArray, IsEmail, IsIn, IsInt, IsOptional, IsString, MinLength } from 'class-validator';
import { Type } from 'class-transformer';
import { PaginacionDto } from '../common/paginacion.dto';

export class ListarDocentesDto extends PaginacionDto {
  @IsOptional() @IsString() buscar?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) plantelId?: number;
}

export class CrearDocenteDto {
  @IsArray() @ArrayNotEmpty() @Type(() => Number) @IsInt({ each: true }) plantelIds!: number[];
  @Normalizar(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim().toLowerCase() : value)
  @IsEmail() @MaxLength(120) email!: string;
  @IsString() @MinLength(8) password!: string;
  @Normalizar(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsString() @LongitudMinima(1) @MaxLength(80) nombre!: string;
  @Normalizar(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsString() @LongitudMinima(1) @MaxLength(80) apellidoPaterno!: string;
  @Normalizar(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsOptional() @IsString() @MaxLength(80) apellidoMaterno?: string;
  @Normalizar(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsOptional() @IsString() @MaxLength(20) telefono?: string;
  @Normalizar(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim().toUpperCase() : value)
  @IsString() @LongitudMinima(1) @MaxLength(20) numEmpleado!: string;
  @Normalizar(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsOptional() @IsString() @MaxLength(20) cedulaProfesional?: string;
  @Normalizar(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsOptional() @IsString() @MaxLength(120) especialidad?: string;
}

export class ActualizarDocenteDto {
  @Normalizar(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @OpcionalNoNulo() @IsString() @LongitudMinima(1) @MaxLength(80) nombre?: string;
  @Normalizar(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @OpcionalNoNulo() @IsString() @LongitudMinima(1) @MaxLength(80) apellidoPaterno?: string;
  @Normalizar(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsOptional() @IsString() @MaxLength(80) apellidoMaterno?: string;
  @Normalizar(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsOptional() @IsString() @MaxLength(20) telefono?: string;
  @Normalizar(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsOptional() @IsString() @MaxLength(20) cedulaProfesional?: string;
  @Normalizar(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsOptional() @IsString() @MaxLength(120) especialidad?: string;
  @OpcionalNoNulo() @IsIn(['ACTIVO', 'BAJA']) estatus?: 'ACTIVO' | 'BAJA';
}

export class PlantelesDocenteDto {
  @IsArray() @ArrayNotEmpty() @Type(() => Number) @IsInt({ each: true }) plantelIds!: number[];
}

export class ReactivarDocenteDto extends PlantelesDocenteDto {
  @IsString() @MinLength(3) @MaxLength(500) motivo!: string;
}
