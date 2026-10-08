import { IsDateString, MaxLength, Min, MinLength as LongitudMinima } from 'class-validator';
import { Transform as Normalizar } from 'class-transformer';
import { Type } from 'class-transformer';
import { IsEmail, IsIn, IsInt, IsOptional, IsString, MinLength } from 'class-validator';
import { PaginacionDto } from '../common/paginacion.dto';

export class ListarAlumnosDto extends PaginacionDto {
  @Normalizar(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsOptional() @IsString() buscar?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) plantelId?: number;
}

export class CrearAlumnoDto {
  // Cuenta
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
  // Expediente
  @Normalizar(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim().toUpperCase() : value)
  @IsString() @LongitudMinima(1) @MaxLength(20) matricula!: string;
  @Type(() => Number) @IsInt() @Min(1) plantelId!: number;
  @Normalizar(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim().toUpperCase() : value)
  @IsOptional() @IsString() @MaxLength(18) curp?: string;
  @Normalizar(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsOptional() @IsDateString({ strict: true }) fechaNacimiento?: string; // YYYY-MM-DD
  @Normalizar(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsOptional() @IsString() @MaxLength(120) tutorNombre?: string;
  @Normalizar(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsOptional() @IsString() @MaxLength(20) tutorTelefono?: string;
  @Normalizar(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsOptional() @IsString() @MaxLength(200) direccion?: string;
}

export class TransferirAlumnoDto {
  @Type(() => Number) @IsInt() @Min(1) plantelId!: number;
}

export class ActualizarAlumnoDto {
  @Normalizar(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsOptional() @IsString() @LongitudMinima(1) @MaxLength(80) nombre?: string;
  @Normalizar(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsOptional() @IsString() @LongitudMinima(1) @MaxLength(80) apellidoPaterno?: string;
  @Normalizar(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsOptional() @IsString() @MaxLength(80) apellidoMaterno?: string;
  @Normalizar(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsOptional() @IsString() @MaxLength(20) telefono?: string;
  @Normalizar(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim().toUpperCase() : value)
  @IsOptional() @IsString() @MaxLength(18) curp?: string;
  @Normalizar(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsOptional() @IsDateString({ strict: true }) fechaNacimiento?: string;
  @Normalizar(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsOptional() @IsString() @MaxLength(120) tutorNombre?: string;
  @Normalizar(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsOptional() @IsString() @MaxLength(20) tutorTelefono?: string;
  @Normalizar(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsOptional() @IsString() @MaxLength(200) direccion?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) plantelId?: number;
  @IsOptional() @IsIn(['ACTIVO', 'BAJA', 'EGRESADO']) estatus?: 'ACTIVO' | 'BAJA' | 'EGRESADO';
}

export class ReactivarAlumnoDto {
  @IsString() @LongitudMinima(3) @MaxLength(500) motivo!: string;
}
