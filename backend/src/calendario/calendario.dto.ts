import { PaginacionDto } from '../common/paginacion.dto';
import { PartialType } from '@nestjs/swagger';
import { IsBoolean, IsDateString, MaxLength, MinLength, Min, Matches } from 'class-validator';
import { Transform as Normalizar } from 'class-transformer';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString } from 'class-validator';

export class EventoDto {
  @IsOptional() @IsString() @Matches(/^([a-z0-9-]{1,50})?$/) marcadorClave?: string;
  @IsOptional()
  @Normalizar(({ value }: { value: unknown }) => (value === 'true' ? true : value === 'false' ? false : value))
  @IsBoolean()
  avisar?: boolean;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) cicloId?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) nivelId?: number;
  @IsOptional() @IsIn(['ACADEMICA', 'ADMINISTRATIVA', 'FINANCIERA']) audiencia?:
    'ACADEMICA' | 'ADMINISTRATIVA' | 'FINANCIERA';
  @Normalizar(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  titulo!: string;
  @Normalizar(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsString()
  @MaxLength(400)
  descripcion?: string;
  @IsOptional()
  @IsIn(['GENERAL', 'EXAMEN', 'ENTREGA', 'FESTIVO', 'PAGO', 'JUNTA'])
  tipo?: 'GENERAL' | 'EXAMEN' | 'ENTREGA' | 'FESTIVO' | 'PAGO' | 'JUNTA';
  @Normalizar(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsDateString({ strict: true })
  fechaInicio!: string;
  @Normalizar(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsDateString({ strict: true })
  fechaFin?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) plantelId?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) grupoId?: number;
}

export class EditarEventoDto extends PartialType(EventoDto) {
  @IsString() @MaxLength(64) @MinLength(64) revision!: string;
}

export class ConsultarEventosDto extends PaginacionDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) cicloId?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) nivelId?: number;
  @IsOptional() @IsDateString({ strict: true }) desde?: string;
  @IsOptional() @IsDateString({ strict: true }) hasta?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) plantelId?: number;
  @IsOptional() @IsString() @MaxLength(150) buscar?: string;
}

export class ImportarCalendarioDto {
  @Type(() => Number) @IsInt() @Min(1) cicloId!: number;
  @Type(() => Number) @IsInt() @Min(1) nivelId!: number;
  @Type(() => Number) @IsInt() @Min(1) plantelId!: number;
  @IsIn(['ACADEMICA', 'ADMINISTRATIVA', 'FINANCIERA']) audiencia!: 'ACADEMICA' | 'ADMINISTRATIVA' | 'FINANCIERA';
  @IsString() @MinLength(1) @MaxLength(100000) contenido!: string;
}

export class GuardarMarcadorDto {
  @Type(() => Number) @IsInt() @Min(1) plantelId!: number;
  @IsOptional() @Matches(/^[a-z0-9-]{1,50}$/) clave?: string;
  @IsString() @MinLength(1) @MaxLength(150)
  @Normalizar(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  nombre!: string;
  @Matches(/^#[0-9a-fA-F]{6}$/) color!: string;
  @IsIn(['FONDO', 'INICIO', 'FIN']) forma!: 'FONDO' | 'INICIO' | 'FIN';
  @IsOptional() @IsInt() @Min(0) revision?: number;
}
