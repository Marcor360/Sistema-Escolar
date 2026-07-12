import { Type } from 'class-transformer';
import { IsEmail, IsIn, IsInt, IsOptional, IsString, MinLength } from 'class-validator';
import { PaginacionDto } from '../common/paginacion.dto';

export class ListarAlumnosDto extends PaginacionDto {
  @IsOptional() @IsString() buscar?: string;
  @IsOptional() @Type(() => Number) @IsInt() plantelId?: number;
}

export class CrearAlumnoDto {
  // Cuenta
  @IsEmail() email: string;
  @IsString() @MinLength(8) password: string;
  @IsString() nombre: string;
  @IsString() apellidoPaterno: string;
  @IsOptional() @IsString() apellidoMaterno?: string;
  @IsOptional() @IsString() telefono?: string;
  // Expediente
  @IsString() matricula: string;
  @Type(() => Number) @IsInt() plantelId: number;
  @IsOptional() @IsString() curp?: string;
  @IsOptional() @IsString() fechaNacimiento?: string; // YYYY-MM-DD
  @IsOptional() @IsString() tutorNombre?: string;
  @IsOptional() @IsString() tutorTelefono?: string;
  @IsOptional() @IsString() direccion?: string;
}

export class ActualizarAlumnoDto {
  @IsOptional() @IsString() nombre?: string;
  @IsOptional() @IsString() apellidoPaterno?: string;
  @IsOptional() @IsString() apellidoMaterno?: string;
  @IsOptional() @IsString() telefono?: string;
  @IsOptional() @IsString() curp?: string;
  @IsOptional() @IsString() fechaNacimiento?: string;
  @IsOptional() @IsString() tutorNombre?: string;
  @IsOptional() @IsString() tutorTelefono?: string;
  @IsOptional() @IsString() direccion?: string;
  @IsOptional() @Type(() => Number) @IsInt() plantelId?: number;
  @IsOptional() @IsIn(['ACTIVO', 'BAJA', 'EGRESADO']) estatus?: 'ACTIVO' | 'BAJA' | 'EGRESADO';
}
