import { Type, Transform } from 'class-transformer';
import { IsInt, IsString, MaxLength, Min, MinLength } from 'class-validator';
const limpiar = ({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value;

export class EditarComunicadoDto {
  @Transform(limpiar) @IsString() @MinLength(1) @MaxLength(150) titulo!: string;
  @Transform(limpiar) @IsString() @MinLength(1) @MaxLength(600) mensaje!: string;
}
export class CrearComunicadoDto extends EditarComunicadoDto {
  @Type(() => Number) @IsInt() @Min(1) plantelId!: number;
}
