import { Type, Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength, Length, Matches,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
export class NuevoTramiteDto {
  @IsUUID('4') clave!: string;
  @IsIn(['CONSTANCIA', 'CORRECCION', 'DOCUMENTO']) tipo!: 'CONSTANCIA' | 'CORRECCION' | 'DOCUMENTO';
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(5)
  @MaxLength(600)
  detalle!: string;
}
export class CambiarTramiteDto {
  @IsInt() @Min(1) revision!: number;
  @IsIn(['EN_REVISION', 'RESUELTO', 'RECHAZADO', 'CANCELADO']) estado!:
    'EN_REVISION' | 'RESUELTO' | 'RECHAZADO' | 'CANCELADO';
  @IsOptional() @IsInt() @Min(1) responsableId?: number;
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(5)
  @MaxLength(600)
  mensaje!: string;
}
export class PreferenciaDto {
  @IsIn(['GENERAL', 'ACADEMICA', 'FINANCIERA']) tipo!: 'GENERAL' | 'ACADEMICA' | 'FINANCIERA';
  @IsBoolean() push!: boolean;
  @IsBoolean() correo!: boolean;
}
export class PreferenciasDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(3)
  @ValidateNested({ each: true })
  @Type(() => PreferenciaDto)
  preferencias!: PreferenciaDto[];
}

export class CorreccionCalidadDto {
 @IsInt() @Min(1) alumnoId!:number;
 @IsOptional() @IsString() @MinLength(1) @MaxLength(20) telefono?:string;
 @IsOptional() @IsString() @Matches(/^[A-Z0-9]{18}$/) curp?:string;
 @IsOptional() @IsString() @Length(64,64) revision?:string;
}
