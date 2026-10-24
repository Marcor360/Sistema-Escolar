import { OpcionalNoNulo } from '../common/opcional-no-nulo';
import { MaxLength, Min, MinLength as LongitudMinima } from 'class-validator';
import { Transform as Normalizar } from 'class-transformer';
import { ArrayNotEmpty, IsArray, IsEmail, IsIn, IsInt, IsOptional, IsString, IsBoolean, ValidateIf, MinLength } from 'class-validator';
import { Type } from 'class-transformer';
import { PaginacionDto } from '../common/paginacion.dto';
import { ProveedorCorreo } from '../entities/usuario.entity';

export class ListarDocentesDto extends PaginacionDto {
  @IsOptional() @IsString() buscar?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) plantelId?: number;
}

export class CrearDocenteDto {
  @OpcionalNoNulo() @IsIn(['GODADDY', 'MICROSOFT365']) correoProveedor?: ProveedorCorreo;
  @IsArray() @ArrayNotEmpty() @Type(() => Number) @IsInt({ each: true }) plantelIds!: number[];
  @Normalizar(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim().toLowerCase() : value)
  @IsEmail() @MaxLength(120) email!: string;
  @Normalizar(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsString() @LongitudMinima(1) @MaxLength(80) nombre!: string;
  @Normalizar(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsString() @LongitudMinima(1) @MaxLength(80) apellidoPaterno!: string;
  @Normalizar(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsOptional() @IsString() @MaxLength(80) apellidoMaterno?: string | null;
  @Normalizar(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsOptional() @IsString() @MaxLength(20) telefono?: string | null;
  @Normalizar(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim().toUpperCase() : value)
  @IsString() @LongitudMinima(1) @MaxLength(20) numEmpleado!: string;
  @Normalizar(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsOptional() @IsBoolean() cedulaPendiente?: boolean;
  @Normalizar(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @ValidateIf((dto: CrearDocenteDto) => !dto.cedulaPendiente)
  @IsString() @LongitudMinima(1) @MaxLength(20) cedulaProfesional?: string | null;
  @Normalizar(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsOptional() @IsString() @MaxLength(120) especialidad?: string | null;
}

export class ActualizarDocenteDto {
  @OpcionalNoNulo() @IsIn(['GODADDY', 'MICROSOFT365']) correoProveedor?: ProveedorCorreo;
  @Normalizar(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @OpcionalNoNulo() @IsString() @LongitudMinima(1) @MaxLength(80) nombre?: string;
  @Normalizar(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @OpcionalNoNulo() @IsString() @LongitudMinima(1) @MaxLength(80) apellidoPaterno?: string;
  @Normalizar(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsOptional() @IsString() @MaxLength(80) apellidoMaterno?: string | null;
  @Normalizar(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsOptional() @IsString() @MaxLength(20) telefono?: string | null;
  @Normalizar(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsOptional() @IsString() @MaxLength(20) cedulaProfesional?: string | null;
  @Normalizar(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsOptional() @IsString() @MaxLength(120) especialidad?: string | null;
  @OpcionalNoNulo() @IsIn(['ACTIVO', 'BAJA']) estatus?: 'ACTIVO' | 'BAJA';
}

export class PlantelesDocenteDto {
  @IsArray() @ArrayNotEmpty() @Type(() => Number) @IsInt({ each: true }) plantelIds!: number[];
}

export class ReactivarDocenteDto extends PlantelesDocenteDto {
  @IsString() @MinLength(3) @MaxLength(500) motivo!: string;
}
