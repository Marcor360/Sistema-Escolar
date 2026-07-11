import { IsBoolean, IsEmail, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class CrearPlantelDto {
  @IsString() @Matches(/^[A-Z0-9]{2,10}$/, { message: 'La clave debe tener de 2 a 10 caracteres en mayúsculas' })
  clave: string;
  @IsString() @MinLength(3) @MaxLength(120) nombre: string;
  @IsOptional() @IsString() @MaxLength(200) direccion?: string;
  @IsOptional() @IsString() @MaxLength(80) municipio?: string;
  @IsOptional() @IsString() @MaxLength(20) telefono?: string;
}

export class ActualizarPlantelDto {
  @IsOptional() @IsString() @MinLength(3) @MaxLength(120) nombre?: string;
  @IsOptional() @IsString() @MaxLength(200) direccion?: string;
  @IsOptional() @IsString() @MaxLength(80) municipio?: string;
  @IsOptional() @IsString() @MaxLength(20) telefono?: string;
  @IsOptional() @IsBoolean() activo?: boolean;
}

export class PersonalPlantelDto {
  @IsEmail() email: string;
}
