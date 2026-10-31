import { Type } from 'class-transformer';
import { IsInt, IsISO8601, IsOptional, IsString, Length, Matches, MaxLength, Min } from 'class-validator';

export class RegistrarFirmanteDto {
  @Type(() => Number) @IsInt() @Min(1) plantelId!: number;
  @IsString() @Length(1, 160) nombre!: string;
  @IsString() @Length(1, 100) cargo!: string;
  @IsString() @Matches(/^[A-Z0-9]{18}$/) curp!: string;
  @IsISO8601({ strict: true }) vigenteDesde!: string;
  @IsOptional() @IsISO8601({ strict: true }) vigenteHasta?: string;
  @IsOptional() @IsString() @MaxLength(64) @Matches(/^[a-f0-9]{64}$/) certificadoSha256?: string;
}
