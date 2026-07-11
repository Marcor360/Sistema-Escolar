import { ArrayNotEmpty, IsArray, IsEmail, IsIn, IsInt, IsOptional, IsString, MinLength } from 'class-validator';
import { Type } from 'class-transformer';

export class CrearDocenteDto {
  @IsArray() @ArrayNotEmpty() @Type(() => Number) @IsInt({ each: true }) plantelIds: number[];
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
