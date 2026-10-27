import { Transform } from 'class-transformer';
import { Equals, IsDateString, IsInt, IsString, Matches, MaxLength, Min, MinLength } from 'class-validator';

export class ConciliarEgresoDto {
  @IsInt() @Min(1) cicloId!: number;
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @IsString()
  @Matches(/^[A-ZÑ&]{4}\d{6}[HM][A-ZÑ]{5}[A-Z0-9]\d$/)
  curp!: string;
  @IsDateString({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  fechaEgreso!: string;
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(5)
  @MaxLength(200)
  referenciaDocumental!: string;
  @Equals(true) confirmado!: boolean;
}
