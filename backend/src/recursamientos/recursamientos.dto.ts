import { Equals, IsIn, IsOptional, IsInt, IsNumber, IsUUID, Max, Min } from 'class-validator';
import { TransicionEspecialDto } from '../programas-especiales/programas.dto';
export class InscribirRecursamientoDto {
  @IsInt() @Min(1) alumnoId!: number;
  @IsInt() @Min(1) grupoMateriaId!: number;
  @IsInt() @Min(1) @Max(10000) cupoTotalManual!: number;
  @IsUUID() idempotencia!: string;
  @Equals(true) confirmado!: boolean;
}
export class CupoRecursamientoDto extends TransicionEspecialDto { @IsInt() @Min(1) @Max(10000) cupoTotalManual!: number; }
export class NotaRecursamientoDto extends TransicionEspecialDto {
  @IsOptional() @IsIn([10,100]) escalaMaxima?: number;
  @IsInt() @Min(0) @Max(4) parcial!: number;
  @IsNumber({ maxDecimalPlaces: 6 }) @Min(0) @Max(100) calificacion!: number;
}
