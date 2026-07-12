import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

/** Contrato uniforme de paginación: los listados paginados responden { datos, total, pagina, porPagina }. */
export class PaginacionDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) pagina = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) porPagina = 20;
}
