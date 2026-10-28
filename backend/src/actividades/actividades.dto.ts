import { PaginacionDto } from '../common/paginacion.dto';
import { OpcionalNoNulo } from '../common/opcional-no-nulo';
import { Transform } from 'class-transformer';
const limpiar = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
import {
  IsDateString,
  MaxLength,
  MinLength,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class CrearActividadDto {
  @IsInt() grupoMateriaId!: number;
  @Transform(limpiar) @IsString() @MinLength(1) @MaxLength(150) titulo!: string;
  @IsOptional() @IsString() @MaxLength(4000) descripcion?: string | null;
  @OpcionalNoNulo()
  @IsIn(['TAREA', 'EXAMEN', 'PROYECTO', 'PARTICIPACION'])
  tipo?: 'TAREA' | 'EXAMEN' | 'PROYECTO' | 'PARTICIPACION';
  @OpcionalNoNulo() @IsInt() @Min(0) @Max(4) parcial?: number;
  @OpcionalNoNulo() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(100) ponderacion?: number;
  @IsOptional() @IsDateString({ strict: true }) fechaEntrega?: string | null; // ISO
}

export class ActualizarActividadDto {
  @OpcionalNoNulo() @Transform(limpiar) @IsString() @MinLength(1) @MaxLength(150) titulo?: string;
  @IsOptional() @IsString() @MaxLength(4000) descripcion?: string | null;
  @OpcionalNoNulo()
  @IsIn(['TAREA', 'EXAMEN', 'PROYECTO', 'PARTICIPACION'])
  tipo?: 'TAREA' | 'EXAMEN' | 'PROYECTO' | 'PARTICIPACION';
  @OpcionalNoNulo() @IsInt() @Min(0) @Max(4) parcial?: number;
  @OpcionalNoNulo() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(100) ponderacion?: number;
  @IsOptional() @IsDateString({ strict: true }) fechaEntrega?: string | null;
}

export class EntregarDto {
  @IsOptional() @Transform(limpiar) @IsString() @MaxLength(3000) respuestaTexto?: string | null;
  @IsOptional() @IsString() @MaxLength(500) comentario?: string | null;
}

export class CalificarEntregaDto {
  @IsOptional() @IsIn([10,100]) escalaMaxima?: number;
  @IsNumber({ maxDecimalPlaces: 6 }) @Min(0) @Max(100) calificacion!: number;
  @IsOptional() @IsString() @MaxLength(500) comentario?: string | null;
}

export class ActualizarMaterialDto {
  @Transform(limpiar) @IsString() @MinLength(1) @MaxLength(150) titulo!: string;
}

export class ConsultarClaseDto extends PaginacionDto {
  @IsOptional() @IsString() @MaxLength(150) buscar?: string;
}
