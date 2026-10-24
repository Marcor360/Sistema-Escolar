import { ApiPropertyOptional } from '@nestjs/swagger';
import { OpcionalNoNulo } from '../common/opcional-no-nulo';
import { IsBoolean, IsDateString, IsIn, IsInt, IsNumber, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { PaginacionDto } from '../common/paginacion.dto';

export class ListarCargosDto extends PaginacionDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) plantelId?: number;
  @IsOptional() @IsString() @MaxLength(120) buscar?: string;
  @IsOptional() @Type(() => Number) @IsInt() alumnoId?: number;
  @IsOptional() @IsString() estatus?: string;
  @IsOptional() @Matches(/^\d{4}-(0[1-9]|1[0-2])$/) periodo?: string;
}

export class ListarPendientesDto extends PaginacionDto {
  @Type(() => Number) @IsInt() @Min(1) plantelId!: number;
  @IsOptional() @IsIn(['TODOS', 'VENCIDOS', 'POR_VENCER']) situacion?: 'TODOS' | 'VENCIDOS' | 'POR_VENCER';
  @IsOptional() @Transform(({ value }: { value: unknown }) => value === 'true' ? true : value === 'false' ? false : value)
  @IsBoolean() sinAbono?: boolean;
}

export class ListarPagosDto extends PaginacionDto {
  @IsOptional() @Type(() => Number) @IsInt() alumnoId?: number;
}

export class ConceptoDto {
  @OpcionalNoNulo() @IsBoolean() aplicaRecargo?: boolean;
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim().toUpperCase() : value) @IsString() @MinLength(1) @MaxLength(20) clave!: string;
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value) @IsString() @MinLength(1) @MaxLength(120) nombre!: string;
  @IsIn(['INSCRIPCION', 'COLEGIATURA', 'RECARGO', 'DESCUENTO', 'BECA', 'OTRO'])
  tipo!: 'INSCRIPCION' | 'COLEGIATURA' | 'RECARGO' | 'DESCUENTO' | 'BECA' | 'OTRO';
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(9999999999.99) montoBase!: number;
}

export class ActualizarConceptoDto {
  @OpcionalNoNulo() @IsBoolean() activo?: boolean;
  @OpcionalNoNulo() @IsBoolean() aplicaRecargo?: boolean;
  @OpcionalNoNulo() @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim().toUpperCase() : value) @IsString() @MinLength(1) @MaxLength(20) clave?: string;
  @OpcionalNoNulo() @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value) @IsString() @MinLength(1) @MaxLength(120) nombre?: string;
  @OpcionalNoNulo() @IsIn(['INSCRIPCION', 'COLEGIATURA', 'RECARGO', 'DESCUENTO', 'BECA', 'OTRO'])
  tipo?: 'INSCRIPCION' | 'COLEGIATURA' | 'RECARGO' | 'DESCUENTO' | 'BECA' | 'OTRO';
  @OpcionalNoNulo() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(9999999999.99) montoBase?: number;
}

export class CrearCargoDto {
  @ApiPropertyOptional({ format: 'uuid', description: 'Clave opcional para reintentar la asignación sin registrar dos veces el mismo cargo' })
  @IsOptional() @IsUUID('4') claveIdempotencia?: string;
  @IsInt() @Min(1) alumnoId!: number;
  @IsInt() @Min(1) conceptoId!: number;
  @IsOptional() @IsInt() cicloId?: number;
  @IsOptional() @Matches(/^\d{4}-(0[1-9]|1[0-2])$/) periodo?: string;
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value) @IsString() @MinLength(1) @MaxLength(200) descripcion!: string;
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) @Max(9999999999.99) monto!: number;
  @OpcionalNoNulo() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(9999999999.99) descuento?: number;
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) @IsDateString({ strict: true }) fechaVencimiento?: string;
}

export class GenerarColegiaturasDto {
  @OpcionalNoNulo() @IsBoolean() confirmado?: boolean;
  @IsOptional() @Type(() => Number) @IsInt() plantelId?: number;
  @IsInt() cicloId!: number;
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/) periodo!: string; // YYYY-MM
  @OpcionalNoNulo() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) @Max(9999999999.99) monto?: number; // por defecto, montoBase del concepto COL
  @OpcionalNoNulo() @IsInt() @Min(1) @Max(28) diaVencimiento?: number; // por defecto día 5
}

export class AplicarRecargosDto {
  @OpcionalNoNulo() @IsBoolean() confirmado?: boolean;
  @IsOptional() @Type(() => Number) @IsInt() plantelId?: number;
  @OpcionalNoNulo() @IsNumber() @Min(0.01) @Max(100) porcentaje?: number; // por defecto 10%
}

export class RegistrarPagoDto {
  @IsUUID('4') claveIdempotencia!: string;
  @IsInt() alumnoId!: number;
  @IsInt() @Min(1) cargoId!: number;
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) @Max(9999999999.99) monto!: number;
  @IsIn(['EFECTIVO', 'TRANSFERENCIA', 'TARJETA'])
  metodo!: 'EFECTIVO' | 'TRANSFERENCIA' | 'TARJETA';
  @IsOptional() @IsString() @MaxLength(60) referencia?: string;
}

export class CrearOrdenDto {
  @IsInt() cargoId!: number;
}

export class MotivoFinancieroDto {
  @IsString() @MinLength(3) @MaxLength(500) motivo!: string;
}

export class CobranzaDto {
  @Type(() => Number) @IsInt() @Min(1) plantelId!: number;
  @OpcionalNoNulo() @IsBoolean() confirmado?: boolean;
  @OpcionalNoNulo() @IsBoolean() soloSinAbono?: boolean;
}

export class AplicarPagoDto extends MotivoFinancieroDto {
  @IsInt() @Min(1) cargoId!: number;
}

export class ReintentoCobranzaDto extends MotivoFinancieroDto { @IsBoolean() confirmado!: boolean; }
