import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayNotEmpty, ArrayUnique, IsArray, IsBoolean, IsInt, Min } from 'class-validator';
export class PromocionDto {
  @ApiProperty({ type: Number, minimum: 1 })
  @IsInt() @Min(1) origenGrupoId!: number;
  @ApiProperty({ type: Number, minimum: 1 })
  @IsInt() @Min(1) destinoGrupoId!: number;
}
export class ConfirmarPromocionDto extends PromocionDto {
  @ApiProperty({ type: [Number], maxItems: 500 })
  @IsArray() @ArrayNotEmpty() @ArrayUnique() @ArrayMaxSize(500) @IsInt({ each: true }) @Min(1, { each: true }) alumnoIds!: number[];
  @ApiProperty({ type: Boolean, description: 'Debe ser true para ejecutar la operación' })
  @IsBoolean() confirmado!: boolean;
}
