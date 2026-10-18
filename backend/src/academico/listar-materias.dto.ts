import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginacionDto } from '../common/paginacion.dto';
export class ListarMateriasDto extends PaginacionDto {
  @IsOptional() @IsString() @MaxLength(120)
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  buscar?: string;
}
