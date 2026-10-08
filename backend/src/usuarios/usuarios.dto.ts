import { OpcionalNoNulo } from '../common/opcional-no-nulo';
import { MaxLength, Min, MinLength as LongitudMinima } from 'class-validator';
import { Transform as Normalizar } from 'class-transformer';
import { ArrayNotEmpty, IsArray, IsBoolean, IsEmail, IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import { RolClave } from '../common/roles.decorator';
import { Type } from 'class-transformer';
import { IsInt } from 'class-validator';
import { PaginacionDto } from '../common/paginacion.dto';

const ROLES: RolClave[] = ['ALUMNO', 'MAESTRO', 'ADMINISTRATIVO', 'FINANZAS', 'SUPERADMIN'];

export class CrearUsuarioDto {
  @OpcionalNoNulo() @IsArray() @ArrayNotEmpty() @Type(() => Number) @IsInt({ each: true }) plantelIds?: number[];
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
  @IsArray() @ArrayNotEmpty() @IsIn(ROLES, { each: true }) roles!: RolClave[];
}

export class ActualizarUsuarioDto {
  @Normalizar(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @OpcionalNoNulo() @IsString() @LongitudMinima(1) @MaxLength(80) nombre?: string;
  @Normalizar(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @OpcionalNoNulo() @IsString() @LongitudMinima(1) @MaxLength(80) apellidoPaterno?: string;
  @Normalizar(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsOptional() @IsString() @MaxLength(80) apellidoMaterno?: string;
  @Normalizar(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsOptional() @IsString() @MaxLength(20) telefono?: string;
  @OpcionalNoNulo() @IsBoolean() activo?: boolean;
  @OpcionalNoNulo() @IsString() @MinLength(8) password?: string;
  @OpcionalNoNulo() @IsArray() @IsIn(ROLES, { each: true }) roles?: RolClave[];
}

export class ListadoUsuariosDto extends PaginacionDto {
  @IsIn(['ALUMNO', 'DOCENTE', 'ADMINISTRATIVO']) tipo!: 'ALUMNO' | 'DOCENTE' | 'ADMINISTRATIVO';
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) plantelId?: number;
  @Normalizar(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsOptional() @IsString() buscar?: string;
}

export class ActualizarPersonalDto extends ActualizarUsuarioDto {
  @IsArray() @Type(() => Number) @IsInt({ each: true }) @Min(1, { each: true }) plantelIds!: number[];
}
