import { Type, Transform } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, ArrayUnique, Equals, IsArray, IsDateString, IsIn, IsInt, IsOptional, IsString, IsUUID, Matches, MaxLength, Min } from 'class-validator';
import { PaginacionDto } from '../common/paginacion.dto';
export class PrevisualizarCarteraDto {
  @IsInt() @Min(1) alumnoId!: number;
  @IsInt() @Min(1) plantelId!: number;
  @IsInt() @Min(1) cicloId!: number;
  @IsInt() @Min(1) nivelId!: number;
  @IsInt() @Min(1) carreraId!: number;
  @IsInt() @Min(1) periodoAcademicoId!: number;
  @IsIn(['MATUTINO','VESPERTINO']) turno!: 'MATUTINO' | 'VESPERTINO';
  @IsOptional() @IsInt() @Min(1) grupoId?: number;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(20) @ArrayUnique() @IsInt({ each: true }) @Min(1, { each: true }) conceptoIds!: number[];
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/) periodo!: string;
  @IsDateString({ strict: true }) fechaVencimiento!: string;
}
export class ConfirmarCarteraDto extends PrevisualizarCarteraDto {
  @IsUUID() idempotencia!: string;
  @Matches(/^[a-f0-9]{64}$/) cotizacion!: string;
  @Equals(true) confirmado!: boolean;
}
export class ListarCarteraDto extends PaginacionDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) plantelId?: number;
  @IsOptional() @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value) @IsString() @MaxLength(100) buscar?: string;
}
