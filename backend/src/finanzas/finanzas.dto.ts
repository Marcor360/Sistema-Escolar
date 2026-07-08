import { IsIn, IsInt, IsNumber, IsOptional, IsString, Matches, Max, Min } from 'class-validator';

export class ConceptoDto {
  @IsString() clave: string;
  @IsString() nombre: string;
  @IsIn(['INSCRIPCION', 'COLEGIATURA', 'RECARGO', 'DESCUENTO', 'BECA', 'OTRO'])
  tipo: 'INSCRIPCION' | 'COLEGIATURA' | 'RECARGO' | 'DESCUENTO' | 'BECA' | 'OTRO';
  @IsNumber() @Min(0) montoBase: number;
}

export class CrearCargoDto {
  @IsInt() alumnoId: number;
  @IsInt() conceptoId: number;
  @IsOptional() @IsInt() cicloId?: number;
  @IsOptional() @Matches(/^\d{4}-\d{2}$/) periodo?: string;
  @IsString() descripcion: string;
  @IsNumber() @Min(0) monto: number;
  @IsOptional() @IsNumber() @Min(0) descuento?: number;
  @IsOptional() @IsString() fechaVencimiento?: string; // YYYY-MM-DD
}

export class GenerarColegiaturasDto {
  @IsInt() cicloId: number;
  @Matches(/^\d{4}-\d{2}$/) periodo: string; // YYYY-MM
  @IsOptional() @IsNumber() @Min(0) monto?: number;   // por defecto, montoBase del concepto COL
  @IsOptional() @IsInt() @Min(1) @Max(28) diaVencimiento?: number; // por defecto día 5
}

export class AplicarRecargosDto {
  @IsOptional() @IsNumber() @Min(0) @Max(100) porcentaje?: number; // por defecto 10%
}

export class RegistrarPagoDto {
  @IsInt() alumnoId: number;
  @IsOptional() @IsInt() cargoId?: number;
  @IsNumber() @Min(0.01) monto: number;
  @IsIn(['EFECTIVO', 'TRANSFERENCIA', 'TARJETA'])
  metodo: 'EFECTIVO' | 'TRANSFERENCIA' | 'TARJETA';
  @IsOptional() @IsString() referencia?: string;
}

export class CrearOrdenDto {
  @IsInt() cargoId: number;
}
