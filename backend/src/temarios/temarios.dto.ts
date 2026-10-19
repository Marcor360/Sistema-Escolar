import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsDateString, IsIn, IsInt, IsOptional, IsString, IsUrl, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';
import { PaginacionDto } from '../common/paginacion.dto';
export class CamposTemaDto {
  @ApiProperty({minimum:1,maximum:10000})
  @Type(() => Number) @IsInt() @Min(1) @Max(10000) indice!: number;
  @ApiProperty({maxLength:150})
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsString() @MinLength(1) @MaxLength(150) titulo!: string;
  @ApiProperty({maxLength:20000})
  @IsString() @MinLength(1) @MaxLength(20000) contenido!: string;
  @ApiPropertyOptional({enum:['BORRADOR','PUBLICADO']})
  @IsOptional() @IsIn(['BORRADOR', 'PUBLICADO']) estado?: 'BORRADOR' | 'PUBLICADO';
  @ApiPropertyOptional({type:String,format:'date-time',nullable:true})
  @IsOptional() @IsDateString({ strict: true }) @Matches(/(Z|[+-]\d{2}:\d{2})$/) desde?: string | null;
  @ApiPropertyOptional({type:String,format:'date-time',nullable:true})
  @IsOptional() @IsDateString({ strict: true }) @Matches(/(Z|[+-]\d{2}:\d{2})$/) hasta?: string | null;
  @ApiPropertyOptional({minimum:1,maximum:3,nullable:true})
  @IsOptional() @IsInt() @Min(1) @Max(3) parcial?: number | null;
  @ApiPropertyOptional({type:String,nullable:true,description:'Enlace HTTPS'})
  @IsOptional() @IsUrl({ protocols: ['https'], require_protocol: true, require_valid_protocol: true }) @MaxLength(1000) enlace?: string | null;
}
export class CrearTemaDto extends CamposTemaDto {
  @ApiProperty({minimum:1})
  @Type(() => Number) @IsInt() @Min(1) grupoMateriaId!: number;
}
export class EditarTemaDto extends PartialType(CamposTemaDto) {
  @ApiProperty({minimum:1})
  @Type(() => Number) @IsInt() @Min(1) revision!: number;
}
export class RevisionTemaDto {
  @ApiProperty({minimum:1})
  @Type(() => Number) @IsInt() @Min(1) revision!: number;
}
export class CancelarTemaDto extends RevisionTemaDto {
  @ApiProperty({maxLength:300})
  @IsString() @MinLength(1) @MaxLength(300) motivo!: string;
}
export class ConsultarTemasDto extends PaginacionDto {
  @IsOptional() @IsString() @MaxLength(150) buscar?: string;
}
