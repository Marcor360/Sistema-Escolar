import { IsIn, IsInt, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class CrearActividadDto {
  @IsInt() grupoMateriaId: number;
  @IsString() titulo: string;
  @IsOptional() @IsString() descripcion?: string;
  @IsOptional() @IsIn(['TAREA', 'EXAMEN', 'PROYECTO', 'PARTICIPACION'])
  tipo?: 'TAREA' | 'EXAMEN' | 'PROYECTO' | 'PARTICIPACION';
  @IsOptional() @IsInt() @Min(0) @Max(3) parcial?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(100) ponderacion?: number;
  @IsOptional() @IsString() fechaEntrega?: string; // ISO
}

export class ActualizarActividadDto {
  @IsOptional() @IsString() titulo?: string;
  @IsOptional() @IsString() descripcion?: string;
  @IsOptional() @IsIn(['TAREA', 'EXAMEN', 'PROYECTO', 'PARTICIPACION'])
  tipo?: 'TAREA' | 'EXAMEN' | 'PROYECTO' | 'PARTICIPACION';
  @IsOptional() @IsInt() @Min(0) @Max(3) parcial?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(100) ponderacion?: number;
  @IsOptional() @IsString() fechaEntrega?: string;
}

export class EntregarDto {
  @IsOptional() @IsString() comentario?: string;
}

export class CalificarEntregaDto {
  @IsNumber() @Min(0) @Max(100) calificacion: number;
  @IsOptional() @IsString() comentario?: string;
}
