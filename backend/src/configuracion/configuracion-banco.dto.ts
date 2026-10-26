import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, Length, Matches } from 'class-validator';
const limpiar = ({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value;
export class ConfigurarBbvaDto {
  @Transform(limpiar) @Length(3, 150) titular!: string;
  @Transform(limpiar) @Matches(/^\d{10}$/, { message: 'La cuenta BBVA debe tener 10 dígitos' }) numeroCuenta!: string;
  @IsOptional() @Transform(limpiar) @Matches(/^\d{18}$/, { message: 'La CLABE debe tener 18 dígitos' }) clabe?: string | null;
  @IsBoolean() activo!: boolean;
}
