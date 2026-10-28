import { OpcionalNoNulo } from '../common/opcional-no-nulo';
import { IsDateString, MaxLength, Matches, Min, MinLength as LongitudMinima } from 'class-validator';
import { Transform as Normalizar } from 'class-transformer';
import { Type } from 'class-transformer';
import { IsEmail, IsIn, IsInt, IsOptional, IsString } from 'class-validator';
import { PaginacionDto } from '../common/paginacion.dto';
import type { ProveedorCorreo } from '../entities/usuario.entity';

export class ListarAlumnosDto extends PaginacionDto {
  @Normalizar(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsOptional() @IsString() @MaxLength(120) buscar?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) plantelId?: number;
  @IsOptional() @IsIn(['ACTIVO', 'BAJA', 'EGRESADO']) estatus?: 'ACTIVO' | 'BAJA' | 'EGRESADO';
  @IsOptional() @IsIn(['REGULARES', 'EGRESADOS']) vista?: 'REGULARES' | 'EGRESADOS';
}

export class CrearAlumnoDto {
  // Cuenta
  @Normalizar(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim().toLowerCase() : value)
  @IsEmail() @MaxLength(120) email!: string;
  @Normalizar(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim().toLowerCase() : value)
  @IsOptional() @IsEmail() @MaxLength(120) correoPersonal?: string | null;
  @Normalizar(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsString() @LongitudMinima(1) @MaxLength(80) nombre!: string;
  @Normalizar(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsString() @LongitudMinima(1) @MaxLength(80) apellidoPaterno!: string;
  @Normalizar(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsOptional() @IsString() @MaxLength(80) apellidoMaterno?: string | null;
  @Normalizar(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsOptional() @IsString() @MaxLength(20) telefono?: string | null;
  @OpcionalNoNulo() @IsIn(['GODADDY', 'MICROSOFT365']) correoProveedor?: ProveedorCorreo;
  // Expediente
  @Normalizar(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim().toUpperCase() : value)
  @IsString() @LongitudMinima(1) @MaxLength(20) matricula!: string;
  @Type(() => Number) @IsInt() @Min(1) plantelId!: number;
  @Normalizar(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim().toUpperCase() : value)
  @IsString() @Matches(/^[A-ZÑ&]{4}\d{6}[HM][A-ZÑ]{5}[A-Z0-9]\d$/) curp!: string;
  @Normalizar(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) @IsDateString({ strict: true }) fechaNacimiento?: string; // YYYY-MM-DD
  @Normalizar(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsOptional() @IsString() @MaxLength(120) tutorNombre?: string | null;
  @Normalizar(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsOptional() @IsString() @MaxLength(20) tutorTelefono?: string | null;
  @Normalizar(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsOptional() @IsString() @MaxLength(200) direccion?: string | null;
}

/** Autogestión estricta: no admite cambios de CURP, matrícula, estatus, acceso ni proveedor. */
export class EditarMiPerfilAlumnoDto {
  @Normalizar(({ value }: { value: unknown }) => typeof value === 'string' ? (value.trim() || null) : value)
  @IsOptional() @IsEmail() @MaxLength(120) correoPersonal?: string | null;
  @Normalizar(({ value }: { value: unknown }) => typeof value === 'string' ? (value.trim() || null) : value)
  @IsOptional() @IsString() @MaxLength(20) telefono?: string | null;
  @Normalizar(({ value }: { value: unknown }) => typeof value === 'string' ? (value.trim() || null) : value)
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) @IsDateString({ strict: true }) fechaNacimiento?: string | null;
  @Normalizar(({ value }: { value: unknown }) => typeof value === 'string' ? (value.trim() || null) : value)
  @IsOptional() @IsString() @MaxLength(120) tutorNombre?: string | null;
  @Normalizar(({ value }: { value: unknown }) => typeof value === 'string' ? (value.trim() || null) : value)
  @IsOptional() @IsString() @MaxLength(20) tutorTelefono?: string | null;
  @Normalizar(({ value }: { value: unknown }) => typeof value === 'string' ? (value.trim() || null) : value)
  @IsOptional() @IsString() @MaxLength(200) direccion?: string | null;
}

export class TransferirAlumnoDto {
  @Type(() => Number) @IsInt() @Min(1) plantelId!: number;
}

export class ActualizarAlumnoDto {
  @Normalizar(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim().toLowerCase() : value)
  @IsOptional() @IsEmail() @MaxLength(120) correoPersonal?: string | null;
  @OpcionalNoNulo() @IsIn(['GODADDY', 'MICROSOFT365']) correoProveedor?: ProveedorCorreo;
  @Normalizar(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @OpcionalNoNulo() @IsString() @LongitudMinima(1) @MaxLength(80) nombre?: string;
  @Normalizar(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @OpcionalNoNulo() @IsString() @LongitudMinima(1) @MaxLength(80) apellidoPaterno?: string;
  @Normalizar(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsOptional() @IsString() @MaxLength(80) apellidoMaterno?: string | null;
  @Normalizar(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsOptional() @IsString() @MaxLength(20) telefono?: string | null;
  @Normalizar(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim().toUpperCase() : value)
  @IsOptional() @IsString() @MaxLength(18) curp?: string | null;
  @Normalizar(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) @IsDateString({ strict: true }) fechaNacimiento?: string | null;
  @Normalizar(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsOptional() @IsString() @MaxLength(120) tutorNombre?: string | null;
  @Normalizar(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsOptional() @IsString() @MaxLength(20) tutorTelefono?: string | null;
  @Normalizar(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsOptional() @IsString() @MaxLength(200) direccion?: string | null;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) plantelId?: number;
  @OpcionalNoNulo() @IsIn(['ACTIVO', 'BAJA', 'EGRESADO']) estatus?: 'ACTIVO' | 'BAJA' | 'EGRESADO';
}

export class ReactivarAlumnoDto {
  @IsString() @LongitudMinima(3) @MaxLength(500) motivo!: string;
}
