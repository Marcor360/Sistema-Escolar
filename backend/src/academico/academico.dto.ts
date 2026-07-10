import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString } from 'class-validator';

export class CicloDto {
  @IsString() clave: string;
  @IsString() nombre: string;
  @IsString() fechaInicio: string; // YYYY-MM-DD
  @IsString() fechaFin: string;
  @IsOptional() @IsBoolean() activo?: boolean;
}

export class MateriaDto {
  @IsString() clave: string;
  @IsString() nombre: string;
  @IsOptional() @IsString() descripcion?: string;
  @IsOptional() @IsInt() creditos?: number;
}

export class GrupoDto {
  @Type(() => Number) @IsInt() cicloId: number;
  @Type(() => Number) @IsInt() plantelId: number;
  @IsString() nombre: string;
  @IsOptional() @IsString() grado?: string;
  @IsOptional() @IsIn(['MATUTINO', 'VESPERTINO']) turno?: 'MATUTINO' | 'VESPERTINO';
}

export class AsignarMateriaDto {
  @IsInt() materiaId: number;
  @IsOptional() @IsInt() docenteId?: number;
}

export class InscribirAlumnoDto {
  @IsInt() alumnoId: number;
}
