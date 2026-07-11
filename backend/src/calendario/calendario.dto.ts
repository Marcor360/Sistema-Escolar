import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString } from 'class-validator';

export class EventoDto {
  @IsString() titulo: string;
  @IsOptional() @IsString() descripcion?: string;
  @IsOptional() @IsIn(['GENERAL', 'EXAMEN', 'ENTREGA', 'FESTIVO', 'PAGO', 'JUNTA'])
  tipo?: 'GENERAL' | 'EXAMEN' | 'ENTREGA' | 'FESTIVO' | 'PAGO' | 'JUNTA';
  @IsString() fechaInicio: string;
  @IsOptional() @IsString() fechaFin?: string;
  @IsOptional() @Type(() => Number) @IsInt() plantelId?: number;
  @IsOptional() @Type(() => Number) @IsInt() grupoId?: number;
}
