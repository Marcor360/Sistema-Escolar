import { ArrayNotEmpty, IsArray, IsBoolean, IsEmail, IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import { RolClave } from '../common/roles.decorator';
import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';

const ROLES: RolClave[] = ['ALUMNO', 'MAESTRO', 'ADMINISTRATIVO', 'FINANZAS', 'SUPERADMIN'];

export class CrearUsuarioDto {
  @IsEmail() email: string;
  @IsString() @MinLength(8) password: string;
  @IsString() nombre: string;
  @IsString() apellidoPaterno: string;
  @IsOptional() @IsString() apellidoMaterno?: string;
  @IsOptional() @IsString() telefono?: string;
  @IsArray() @ArrayNotEmpty() @IsIn(ROLES, { each: true }) roles: RolClave[];
}

export class ActualizarUsuarioDto {
  @IsOptional() @IsString() nombre?: string;
  @IsOptional() @IsString() apellidoPaterno?: string;
  @IsOptional() @IsString() apellidoMaterno?: string;
  @IsOptional() @IsString() telefono?: string;
  @IsOptional() @IsBoolean() activo?: boolean;
  @IsOptional() @IsString() @MinLength(8) password?: string;
  @IsOptional() @IsArray() @IsIn(ROLES, { each: true }) roles?: RolClave[];
}

export class ListadoUsuariosDto {
  @IsIn(['ALUMNO', 'DOCENTE', 'ADMINISTRATIVO']) tipo: 'ALUMNO' | 'DOCENTE' | 'ADMINISTRATIVO';
  @IsOptional() @Type(() => Number) @IsInt() plantelId?: number;
  @IsOptional() @IsString() buscar?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) pagina = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) porPagina = 20;
}
