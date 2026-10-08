import { Transform } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsIn, IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';
const limpiar = ({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value;
export class DifundirDto {
  @Transform(limpiar) @IsString() @MinLength(1) @MaxLength(150) titulo!: string;
  @Transform(limpiar) @IsString() @MinLength(1) @MaxLength(600) mensaje!: string;
  @IsOptional() @IsArray() @ArrayMaxSize(500) @IsInt({ each: true }) @Min(1, { each: true }) usuarioIds?: number[];
  @IsOptional() @IsIn(['ALUMNO', 'MAESTRO', 'ADMINISTRATIVO', 'FINANZAS']) rol?: string;
}
