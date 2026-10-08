import { Transform } from 'class-transformer';
const limpiar = ({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value;
import { Length, Matches } from 'class-validator';

export class ActualizarMarcaDto {
  @Transform(limpiar) @Length(2, 150)
  nombreInstitucion!: string;

  @Transform(limpiar) @Length(1, 10)
  nombreCorto!: string;

  @Matches(/^#[0-9a-fA-F]{6}$/, { message: 'Color en formato #RRGGBB' })
  colorPrimario!: string;

  @Matches(/^#[0-9a-fA-F]{6}$/, { message: 'Color en formato #RRGGBB' })
  colorAcento!: string;
}

export interface MarcaPublicaDto {
  nombreInstitucion: string;
  nombreCorto: string;
  logoUrl: string | null;
  colorPrimario: string;
  colorPrimarioOscuro: string;
  colorAcento: string;
  actualizadoEn: Date;
}
