import { IsBoolean, IsDateString, IsIn, IsInt, IsNumber, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';
import { Type } from 'class-transformer';
import { PaginacionDto } from '../common/paginacion.dto';

export class ListarCargosDto extends PaginacionDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) plantelId?: number;
  @IsOptional() @IsString() buscar?: string;
  @IsOptional() @Type(() => Number) @IsInt() alumnoId?: number;
  @IsOptional() @IsString() estatus?: string;
  @IsOptional() @Matches(/^\d{4}-(0[1-9]|1[0-2])$/) periodo?: string;
}

export class ListarPagosDto extends PaginacionDto {
  @IsOptional() @Type(() => Number) @IsInt() alumnoId?: number;
}

export class ConceptoDto {
  @IsOptional() @IsBoolean() aplicaRecargo?: boolean;
  @IsString() clave: string;
  @IsString() nombre: string;
  @IsIn(['INSCRIPCION', 'COLEGIATURA', 'RECARGO', 'DESCUENTO', 'BECA', 'OTRO'])
  tipo: 'INSCRIPCION' | 'COLEGIATURA' | 'RECARGO' | 'DESCUENTO' | 'BECA' | 'OTRO';
  @IsNumber() @Min(0) montoBase: number;
}

export class ActualizarConceptoDto {
  @IsOptional() @IsBoolean() activo?: boolean;
  @IsOptional() @IsBoolean() aplicaRecargo?: boolean;
  @IsOptional() @IsString() clave?: string;
  @IsOptional() @IsString() nombre?: string;
  @IsOptional() @IsIn(['INSCRIPCION', 'COLEGIATURA', 'RECARGO', 'DESCUENTO', 'BECA', 'OTRO'])
  tipo?: 'INSCRIPCION' | 'COLEGIATURA' | 'RECARGO' | 'DESCUENTO' | 'BECA' | 'OTRO';
  @IsOptional() @IsNumber() @Min(0) montoBase?: number;
}

export class CrearCargoDto {
  @IsInt() alumnoId: number;
  @IsInt() conceptoId: number;
  @IsOptional() @IsInt() cicloId?: number;
  @IsOptional() @Matches(/^\d{4}-(0[1-9]|1[0-2])$/) periodo?: string;
  @IsString() descripcion: string;
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) monto: number;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) descuento?: number;
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) @IsDateString({ strict: true }) fechaVencimiento?: string;
}

export class GenerarColegiaturasDto {
  @IsOptional() @IsBoolean() confirmado?: boolean;
  @IsOptional() @Type(() => Number) @IsInt() plantelId?: number;
  @IsInt() cicloId: number;
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/) periodo: string; // YYYY-MM
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) monto?: number; // por defecto, montoBase del concepto COL
  @IsOptional() @IsInt() @Min(1) @Max(28) diaVencimiento?: number; // por defecto día 5
}

export class AplicarRecargosDto {
  @IsOptional() @IsBoolean() confirmado?: boolean;
  @IsOptional() @Type(() => Number) @IsInt() plantelId?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(100) porcentaje?: number; // por defecto 10%
}

export class RegistrarPagoDto {
  @IsUUID('4') claveIdempotencia: string;
  @IsInt() alumnoId: number;
  @IsInt() @Min(1) cargoId: number;
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) monto: number;
  @IsIn(['EFECTIVO', 'TRANSFERENCIA', 'TARJETA'])
  metodo: 'EFECTIVO' | 'TRANSFERENCIA' | 'TARJETA';
  @IsOptional() @IsString() referencia?: string;
}

export class CrearOrdenDto {
  @IsInt() cargoId: number;
}

export class MotivoFinancieroDto {
  @IsString() @MinLength(3) @MaxLength(500) motivo: string;
}

export class CobranzaDto {
  @Type(() => Number) @IsInt() @Min(1) plantelId: number;
  @IsOptional() @IsBoolean() confirmado?: boolean;
}

export class AplicarPagoDto extends MotivoFinancieroDto {
  @IsInt() @Min(1) cargoId: number;
}

export class ReintentoCobranzaDto extends MotivoFinancieroDto { @IsBoolean() confirmado: boolean; }
