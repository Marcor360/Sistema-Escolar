import { Transform } from 'class-transformer';
const limpiar = ({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value;
import { IsDateString, MaxLength, MinLength, IsIn, IsInt, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class CrearActividadDto {
  @IsInt() grupoMateriaId: number;
  @Transform(limpiar) @IsString() @MinLength(1) @MaxLength(150) titulo: string;
  @IsOptional() @IsString() @MaxLength(4000) descripcion?: string;
  @IsOptional() @IsIn(['TAREA', 'EXAMEN', 'PROYECTO', 'PARTICIPACION'])
  tipo?: 'TAREA' | 'EXAMEN' | 'PROYECTO' | 'PARTICIPACION';
  @IsOptional() @IsInt() @Min(0) @Max(3) parcial?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(100) ponderacion?: number;
  @IsOptional() @IsDateString({ strict: true }) fechaEntrega?: string | null; // ISO
}

export class ActualizarActividadDto {
  @IsOptional() @Transform(limpiar) @IsString() @MinLength(1) @MaxLength(150) titulo?: string;
  @IsOptional() @IsString() @MaxLength(4000) descripcion?: string;
  @IsOptional() @IsIn(['TAREA', 'EXAMEN', 'PROYECTO', 'PARTICIPACION'])
  tipo?: 'TAREA' | 'EXAMEN' | 'PROYECTO' | 'PARTICIPACION';
  @IsOptional() @IsInt() @Min(0) @Max(3) parcial?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(100) ponderacion?: number;
  @IsOptional() @IsDateString({ strict: true }) fechaEntrega?: string | null;
}

export class EntregarDto {
  @IsOptional() @IsString() @MaxLength(500) comentario?: string;
}

export class CalificarEntregaDto {
  @IsNumber() @Min(0) @Max(100) calificacion: number;
  @IsOptional() @IsString() @MaxLength(500) comentario?: string;
}

export class ActualizarMaterialDto {
  @Transform(limpiar) @IsString() @MinLength(1) @MaxLength(150) titulo: string;
}
