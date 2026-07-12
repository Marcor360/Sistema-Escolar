import { Length, Matches } from 'class-validator';

export class ActualizarMarcaDto {
  @Length(2, 150)
  nombreInstitucion: string;

  @Length(1, 10)
  nombreCorto: string;

  @Matches(/^#[0-9a-fA-F]{6}$/, { message: 'Color en formato #RRGGBB' })
  colorPrimario: string;

  @Matches(/^#[0-9a-fA-F]{6}$/, { message: 'Color en formato #RRGGBB' })
  colorAcento: string;
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
