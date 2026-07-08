import { IsEmail, IsIn, IsOptional, IsString, MinLength } from 'class-validator';

export class CrearDocenteDto {
  @IsEmail() email: string;
  @IsString() @MinLength(8) password: string;
  @IsString() nombre: string;
  @IsString() apellidoPaterno: string;
  @IsOptional() @IsString() apellidoMaterno?: string;
  @IsOptional() @IsString() telefono?: string;
  @IsString() numEmpleado: string;
  @IsOptional() @IsString() cedulaProfesional?: string;
  @IsOptional() @IsString() especialidad?: string;
}

export class ActualizarDocenteDto {
  @IsOptional() @IsString() nombre?: string;
  @IsOptional() @IsString() apellidoPaterno?: string;
  @IsOptional() @IsString() apellidoMaterno?: string;
  @IsOptional() @IsString() telefono?: string;
  @IsOptional() @IsString() cedulaProfesional?: string;
  @IsOptional() @IsString() especialidad?: string;
  @IsOptional() @IsIn(['ACTIVO', 'BAJA']) estatus?: 'ACTIVO' | 'BAJA';
}
