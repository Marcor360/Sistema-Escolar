import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { Equals, IsIn, IsNumber, IsString, IsUUID, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';
export class RegistrarPagoFichaDto {
  @ApiProperty({ example: 'IUA-C0000000123' }) @Matches(/^IUA-C\d{10}$/) identificador!: string;
  @IsUUID('4') claveIdempotencia!: string;
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) @Max(9999999999.99) monto!: number;
  @IsIn(['EFECTIVO','TRANSFERENCIA']) metodo!: 'EFECTIVO' | 'TRANSFERENCIA';
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsString() @MinLength(5) @MaxLength(60) referenciaBancaria!: string;
  @ApiProperty({ description: 'FINANZAS verificó los fondos manualmente contra el comprobante' }) @Equals(true) confirmado!: true;
}
