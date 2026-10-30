import { Equals } from 'class-validator';
import { OmitType } from '@nestjs/swagger';
import { PasswordNuevaValida } from '../common/password-bcrypt';
import { OpcionalNoNulo } from '../common/opcional-no-nulo';
import { MaxLength, Min, MinLength as LongitudMinima } from 'class-validator';
import { Transform as Normalizar } from 'class-transformer';
import { ArrayNotEmpty, IsArray, IsBoolean, IsEmail, IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import { RolClave } from '../common/roles.decorator';
import type { ProveedorCorreo } from '../entities/usuario.entity';
import { Type } from 'class-transformer';
import { IsInt } from 'class-validator';
import { PaginacionDto } from '../common/paginacion.dto';

const ROLES: RolClave[] = ['ALUMNO', 'MAESTRO', 'ADMINISTRATIVO', 'FINANZAS', 'DIRECTOR', 'SUPERADMIN'];

export class CrearUsuarioDto {
  @OpcionalNoNulo() @IsArray() @ArrayNotEmpty() @Type(() => Number) @IsInt({ each: true }) plantelIds?: number[];
  @Normalizar(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim().toLowerCase() : value)
  @IsEmail() @MaxLength(120) email!: string;
  @IsString() @MinLength(8) @PasswordNuevaValida() password!: string;
  @Normalizar(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsString() @LongitudMinima(1) @MaxLength(80) nombre!: string;
  @Normalizar(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() || null : value)
  @IsOptional() @IsString() @MaxLength(80) segundoNombre?: string | null;
  @Normalizar(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsString() @LongitudMinima(1) @MaxLength(80) apellidoPaterno!: string;
  @Normalizar(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsString() @LongitudMinima(1) @MaxLength(80) apellidoMaterno?: string | null;
  @Normalizar(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsOptional() @IsString() @MaxLength(20) telefono?: string | null;
  @IsArray() @ArrayNotEmpty() @IsIn(ROLES, { each: true }) roles!: RolClave[];
  @OpcionalNoNulo() @IsIn(['GODADDY', 'MICROSOFT365']) correoProveedor?: ProveedorCorreo;
}

/** El personal recibe un enlace privado para definir su contraseña; nunca se solicita una temporal en el alta. */
export class CrearPersonalDto extends OmitType(CrearUsuarioDto, ['password'] as const) {}

export class ActualizarUsuarioDto {
  @Normalizar(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @OpcionalNoNulo() @IsString() @LongitudMinima(1) @MaxLength(80) nombre?: string;
  @Normalizar(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() || null : value)
  @IsOptional() @IsString() @MaxLength(80) segundoNombre?: string | null;
  @Normalizar(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @OpcionalNoNulo() @IsString() @LongitudMinima(1) @MaxLength(80) apellidoPaterno?: string;
  @Normalizar(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsOptional() @IsString() @MaxLength(80) apellidoMaterno?: string | null;
  @Normalizar(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsOptional() @IsString() @MaxLength(20) telefono?: string | null;
  @OpcionalNoNulo() @IsBoolean() activo?: boolean;
  @OpcionalNoNulo() @IsString() @MinLength(8) @PasswordNuevaValida() password?: string;
  @OpcionalNoNulo() @IsArray() @IsIn(ROLES, { each: true }) roles?: RolClave[];
  @OpcionalNoNulo() @IsIn(['GODADDY', 'MICROSOFT365']) correoProveedor?: ProveedorCorreo;
}

export class ListadoUsuariosDto extends PaginacionDto {
  @IsOptional() @IsIn(['true', 'false']) sinCorreo?: string;
  @IsOptional() @IsIn(['true', 'false']) activacionPendiente?: string;
  @IsIn(['ALUMNO', 'DOCENTE', 'ADMINISTRATIVO', 'PERSONAL']) tipo!: 'ALUMNO' | 'DOCENTE' | 'ADMINISTRATIVO' | 'PERSONAL';
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) plantelId?: number;
  @Normalizar(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsOptional() @IsString() buscar?: string;
}

export class ActualizarPersonalDto extends OmitType(ActualizarUsuarioDto, ['password'] as const) {
  @Equals(undefined, { message: 'Usa la acción de restablecimiento de contraseña' }) password?: never;
  @IsArray() @Type(() => Number) @IsInt({ each: true }) @Min(1, { each: true }) plantelIds!: number[];
}

/** Restablecimiento por personal autorizado: nunca solicita la contraseña anterior del titular. */
export class RestablecerPasswordAdministrativoDto {
  @IsString() @MinLength(8) @PasswordNuevaValida() nueva!: string;
}

/** Solo roles de personal: la vinculación de alumnos y la condición docente son procesos distintos. */
export class AsignarRolesPersonalDto {
  @IsArray() @ArrayNotEmpty() @IsIn(ROLES, { each: true })
  roles!: RolClave[];
}

export class AsignarCorreoAlumnoDto {
  @Normalizar(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim().toLowerCase() : value)
  @IsEmail() @MaxLength(120) email!: string;
  @IsIn(['GODADDY', 'MICROSOFT365']) correoProveedor!: ProveedorCorreo;
}
