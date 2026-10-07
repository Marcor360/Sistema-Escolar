import { ArrayMaxSize, ArrayNotEmpty, ArrayUnique, IsArray, IsBoolean, IsInt, Min } from 'class-validator';
export class PromocionDto {
  @IsInt() @Min(1) origenGrupoId: number;
  @IsInt() @Min(1) destinoGrupoId: number;
}
export class ConfirmarPromocionDto extends PromocionDto {
  @IsArray() @ArrayNotEmpty() @ArrayUnique() @ArrayMaxSize(500) @IsInt({ each: true }) @Min(1, { each: true }) alumnoIds: number[];
  @IsBoolean() confirmado: boolean;
}
