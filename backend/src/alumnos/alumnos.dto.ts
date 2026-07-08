import { IsEmail, IsIn, IsOptional, IsString, MinLength } from 'class-validator';

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
  @IsOptional() @IsIn(['ACTIVO', 'BAJA', 'EGRESADO']) estatus?: 'ACTIVO' | 'BAJA' | 'EGRESADO';
}
