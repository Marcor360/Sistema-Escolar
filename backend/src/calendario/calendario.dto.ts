import { IsDateString, MaxLength, Min } from 'class-validator';
import { Transform as Normalizar } from 'class-transformer';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString } from 'class-validator';

export class EventoDto {
  @Normalizar(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsString() @MaxLength(150) titulo!: string;
  @Normalizar(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsOptional() @IsString() @MaxLength(400) descripcion?: string;
  @IsOptional() @IsIn(['GENERAL', 'EXAMEN', 'ENTREGA', 'FESTIVO', 'PAGO', 'JUNTA'])
  tipo?: 'GENERAL' | 'EXAMEN' | 'ENTREGA' | 'FESTIVO' | 'PAGO' | 'JUNTA';
  @Normalizar(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsDateString({ strict: true }) fechaInicio!: string;
  @Normalizar(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsOptional() @IsDateString({ strict: true }) fechaFin?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) plantelId?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) grupoId?: number;
}
