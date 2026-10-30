import { Type, Transform } from 'class-transformer';
import { Equals, IsIn, IsInt, IsOptional, IsString, IsUUID, Length, Matches, MaxLength, Min } from 'class-validator';
import { PaginacionDto } from '../common/paginacion.dto';
const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
export class ResponderBoletaDto {
  @IsUUID() idempotencia!: string;
  @Matches(/^[a-f0-9]{64}$/) versionHash!: string;
  @IsIn(['ACEPTADA', 'REVISION']) estado!: 'ACEPTADA' | 'REVISION';
  @Transform(trim) @IsString() @Length(3, 150) firmanteNombre!: string;
  @IsIn(['ALUMNO', 'TUTOR']) firmanteTipo!: 'ALUMNO' | 'TUTOR';
  @IsOptional() @Transform(trim) @IsString() @MaxLength(2000) comentario?: string;
  @Equals(true) confirmado!: boolean;
}
export class ComentarioBoletaDto {
  @IsUUID() idempotencia!: string;
  @Matches(/^[a-f0-9]{64}$/) versionHash!: string;
  @IsInt() @Min(1) grupoMateriaId!: number;
  @Transform(trim) @IsString() @Length(1, 2000) comentario!: string;
}
export class ListarBoletasDto extends PaginacionDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) plantelId?: number;
  @IsOptional() @IsIn(['ACEPTADA', 'REVISION', 'PENDIENTE_RESPUESTA']) estado?:
    'ACEPTADA' | 'REVISION' | 'PENDIENTE_RESPUESTA';
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) grupoId?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) cicloId?: number;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(100) buscar?: string;
  @IsOptional() @IsIn(['PENDIENTE', 'EN_ATENCION', 'RESUELTA']) atencion?: string;
}

export class AtenderBoletaDto {
  @IsUUID() idempotencia!: string;
  @Matches(/^[a-f0-9]{64}$/) versionHash!: string;
  @IsInt() @Min(1) respuestaId!: number;
  @IsInt() @Min(1) responsableId!: number;
  @IsIn(['PENDIENTE', 'EN_ATENCION', 'RESUELTA']) estado!: 'PENDIENTE' | 'EN_ATENCION' | 'RESUELTA';
  @Transform(trim) @IsString() @Length(1, 2000) comentario!: string;
}

export class FiltrosBoletaDto extends ListarBoletasDto {
  @IsIn(['plantel', 'ciclo', 'grupo']) tipo!: 'plantel' | 'ciclo' | 'grupo';
}
