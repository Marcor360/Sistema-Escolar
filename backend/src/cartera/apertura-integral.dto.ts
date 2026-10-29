import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  Equals,
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { AlumnoSinCorreoDto } from '../alumnos/alumnos.dto';

export class CuotaAperturaDto {
  @IsInt() @Min(1) conceptoId!: number;
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/) periodo!: string;
  @Matches(/^\d{4}-\d{2}-\d{2}$/) @IsDateString({ strict: true }) fechaVencimiento!: string;
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) @Max(9999999999.99) monto!: number;
}
export class AperturaIntegralDto {
  @IsOptional() @IsInt() @Min(1) alumnoId?: number;
  @IsOptional() @ValidateNested() @Type(() => AlumnoSinCorreoDto) nuevoAlumno?: AlumnoSinCorreoDto;
  @IsInt() @Min(1) plantelId!: number;
  @IsInt() @Min(1) cicloId!: number;
  @IsInt() @Min(1) nivelId!: number;
  @IsInt() @Min(1) carreraId!: number;
  @IsInt() @Min(1) periodoAcademicoId!: number;
  @IsIn(['MATUTINO', 'VESPERTINO']) turno!: 'MATUTINO' | 'VESPERTINO';
  @IsIn(['PAUSA', 'AUTOMATICA', 'GRUPO']) asignacion!: 'PAUSA' | 'AUTOMATICA' | 'GRUPO';
  @IsOptional() @IsInt() @Min(1) grupoId?: number;
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) @Max(9999999999.99) total!: number;
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(60)
  @ValidateNested({ each: true })
  @Type(() => CuotaAperturaDto)
  cuotas!: CuotaAperturaDto[];
}
export class ConfirmarAperturaIntegralDto extends AperturaIntegralDto {
  @IsUUID() idempotencia!: string;
  @Matches(/^[a-f0-9]{64}$/) cotizacion!: string;
  @Equals(true) confirmado!: boolean;
}
export class ReanudarAperturaDto {
  @IsOptional() @IsInt() @Min(1) grupoId?: number;
  @IsString() @MinLength(10) @MaxLength(500) motivo!: string;
  @Equals(true) confirmado!: boolean;
}
