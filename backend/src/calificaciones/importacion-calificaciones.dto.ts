import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
export class ContextoNotasDto {
  @Type(() => Number) @IsInt() @Min(1) grupoMateriaId!: number;
  @Type(() => Number) @IsInt() @Min(0) @Max(3) parcial!: number;
  @IsOptional() @IsString() @MaxLength(300) motivo?: string;
}
export class ConfirmarNotasDto {
  @IsUUID('4') previewId!: string;
  @IsBoolean() confirmado!: boolean;
}
