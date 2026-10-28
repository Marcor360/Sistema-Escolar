import { Type, Transform } from 'class-transformer';
import { IsBoolean, IsDateString, IsIn, IsInt, IsString, Max, MaxLength, Min, MinLength, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OpcionalNoNulo } from '../common/opcional-no-nulo';
import { PaginacionDto } from '../common/paginacion.dto';

export class NombreCatalogoDto {
  @ApiProperty() @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim().toUpperCase() : value)
  @IsString() @MinLength(1) @MaxLength(20) clave!: string;
  @ApiProperty() @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsString() @MinLength(1) @MaxLength(120) nombre!: string;
}
export class CrearNivelDto extends NombreCatalogoDto {
  @ApiProperty() @Type(() => Number) @IsInt() @Min(1) plantelId!: number;
}
export class CrearCarreraDto extends CrearNivelDto {
  @ApiProperty() @Type(() => Number) @IsInt() @Min(1) nivelId!: number;
  @ApiProperty() @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsString() @MinLength(1) @MaxLength(40) versionPlan!: string;
}
export class CrearPeriodoDto extends CrearNivelDto {
  @ApiProperty() @Type(() => Number) @IsInt() @Min(1) carreraId!: number;
  @ApiProperty() @Type(() => Number) @IsInt() @Min(1) cicloId!: number;
  @ApiProperty({ enum: ['ANUAL', 'SEMESTRAL', 'CUATRIMESTRAL'] })
  @IsIn(['ANUAL', 'SEMESTRAL', 'CUATRIMESTRAL']) tipo!: 'ANUAL' | 'SEMESTRAL' | 'CUATRIMESTRAL';
  @ApiProperty() @Type(() => Number) @IsInt() @Min(1) @Max(1000) numero!: number;
  @IsOptional() @IsDateString({strict:true}) fechaInicio?:string;
  @IsOptional() @IsDateString({strict:true}) fechaFin?:string;
}
export class EditarCatalogoDto {
  @ApiPropertyOptional() @OpcionalNoNulo() @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim().toUpperCase() : value)
  @IsString() @MinLength(1) @MaxLength(20) clave?: string;
  @ApiPropertyOptional() @OpcionalNoNulo() @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsString() @MinLength(1) @MaxLength(120) nombre?: string;
  @ApiPropertyOptional() @OpcionalNoNulo() @IsBoolean() activo?: boolean;
}
export class EditarPeriodoDto extends EditarCatalogoDto {
  @OpcionalNoNulo() @IsDateString({strict:true}) fechaInicio?:string;
  @OpcionalNoNulo() @IsDateString({strict:true}) fechaFin?:string;
}
export class ListarCatalogosDto extends PaginacionDto {
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(1) plantelId?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(1) nivelId?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(1) carreraId?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(1) cicloId?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) buscar?: string;
  @ApiPropertyOptional() @IsOptional() @IsIn(['true', 'false']) inactivos?: string;
}
