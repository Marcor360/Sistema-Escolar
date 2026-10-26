import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  Max,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
export class ConsultaAsistenciaDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) grupoMateriaId?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) alumnoId?: number;
  @IsOptional() @IsDateString({ strict: true }) @Matches(/^\d{4}-\d{2}-\d{2}$/) desde?: string;
  @IsOptional() @IsDateString({ strict: true }) @Matches(/^\d{4}-\d{2}-\d{2}$/) hasta?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(10000) pagina?: number;
}
export class RegistroAsistenciaDto {
  @IsInt() @Min(1) alumnoId!: number;
  @IsIn(['PRESENTE', 'FALTA', 'RETARDO', 'JUSTIFICADA']) estado!: 'PRESENTE' | 'FALTA' | 'RETARDO' | 'JUSTIFICADA';
}
export class CapturaAsistenciaDto {
  @IsInt() @Min(1) grupoMateriaId!: number;
  @IsDateString({ strict: true }) @Matches(/^\d{4}-\d{2}-\d{2}$/) fecha!: string;
  @IsString() @Length(64, 64) revision!: string;
  @IsString() @MinLength(3) @MaxLength(250) motivo!: string;
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => RegistroAsistenciaDto)
  registros!: RegistroAsistenciaDto[];
}
