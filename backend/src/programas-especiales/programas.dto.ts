import { OpcionalNoNulo } from '../common/opcional-no-nulo';
import { Type, Transform } from 'class-transformer';
import { IsBoolean, Equals, IsDateString, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CrearNivelDto, ListarCatalogosDto } from '../catalogos-academicos/catalogos.dto';
import { ContextoAcademicoOpcionalDto } from '../academico/academico.dto';
export class CrearProgramaDto extends CrearNivelDto {
  @ApiProperty() @Type(() => Number) @IsInt() @Min(1) cicloId!: number;
  @ApiProperty({ enum: ['DIPLOMADO', 'CERTIFICACION', 'ESPECIALIZACION', 'EXTRACURRICULAR'] }) @IsIn(['DIPLOMADO', 'CERTIFICACION', 'ESPECIALIZACION', 'EXTRACURRICULAR']) tipo!: 'DIPLOMADO' | 'CERTIFICACION' | 'ESPECIALIZACION' | 'EXTRACURRICULAR';
  @ApiProperty() @IsDateString({ strict: true }) fechaInicio!: string;
  @ApiProperty() @IsDateString({ strict: true }) fechaFin!: string;
}
export class EditarProgramaDto {
  @ApiPropertyOptional() @OpcionalNoNulo() @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value) @IsString() @MinLength(1) @MaxLength(120) nombre?: string;
}
export class ListarProgramasDto extends ListarCatalogosDto {
  @ApiPropertyOptional() @IsOptional() @IsIn(['ACTIVO', 'CERRADO', 'CANCELADO']) estado?: 'ACTIVO' | 'CERRADO' | 'CANCELADO';
}
export class CrearGrupoEspecialDto extends ContextoAcademicoOpcionalDto {
  @ApiProperty() @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value) @IsString() @MinLength(1) @MaxLength(40) nombre!: string;
  @ApiPropertyOptional() @IsOptional() @IsIn(['MATUTINO', 'VESPERTINO']) turno?: 'MATUTINO' | 'VESPERTINO';
  @ApiProperty({ minimum: 1, maximum: 10000, description: 'Cupo manual explícito, independiente de la regla regular 5–50' }) @IsInt() @Min(1) @Max(10000) cupoManual!: number;
  @ApiProperty() @IsInt() @Min(1) materiaId!: number;
  @ApiProperty() @IsInt() @Min(1) docenteId!: number;
}
export class AsignaturaEspecialDto {
  @ApiProperty() @IsInt() @Min(1) materiaId!: number;
  @ApiProperty() @IsInt() @Min(1) docenteId!: number;
}
export class InscribirEspecialDto { @ApiProperty() @IsInt() @Min(1) alumnoId!: number; }
export class TransicionEspecialDto {
  @ApiProperty() @IsBoolean() @Equals(true) confirmado!: boolean;
  @ApiProperty() @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value) @IsString() @MinLength(3) @MaxLength(400) motivo!: string;
}
export class EditarGrupoEspecialDto {
  @ApiPropertyOptional() @OpcionalNoNulo() @IsInt() @Min(1) @Max(10000) cupoManual?: number;
}
