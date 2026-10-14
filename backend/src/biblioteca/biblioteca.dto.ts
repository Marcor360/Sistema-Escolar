import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';
export class ConsultaBibliotecaDto {
  @Type(() => Number) @IsInt() @Min(1) plantelId!: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) carpetaId?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) pagina = 1;
}
export class CrearCarpetaDto {
  @Type(() => Number) @IsInt() @Min(1) plantelId!: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) padreId?: number;
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  nombre!: string;
}
export class SubirBibliotecaDto {
  @Type(() => Number) @IsInt() @Min(1) carpetaId!: number;
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  titulo!: string;
  @IsIn(['FOTO', 'LOGO', 'CALENDARIO', 'DOCUMENTO']) categoria!: 'FOTO' | 'LOGO' | 'CALENDARIO' | 'DOCUMENTO';
}
