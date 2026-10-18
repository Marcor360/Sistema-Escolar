import { Equals, IsInt, IsNumber, IsUUID, Max, Min } from 'class-validator';
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
  @IsInt() @Min(0) @Max(3) parcial!: number;
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(100) calificacion!: number;
}
