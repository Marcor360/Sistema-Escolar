import { OpcionalNoNulo } from '../common/opcional-no-nulo';
import { Transform } from 'class-transformer';
const limpiar = ({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value;
import { IsIn, Length, Matches } from 'class-validator';

export class ActualizarMarcaDto {
  @OpcionalNoNulo() @Transform(limpiar) @Length(2, 150) nombreAdministrativo?: string;
  @OpcionalNoNulo() @Transform(limpiar) @Length(2, 150) nombrePortalAlumno?: string;
  @Transform(limpiar) @Length(2, 150)
  nombreInstitucion!: string;

  @Transform(limpiar) @Length(1, 10)
  nombreCorto!: string;

  @Matches(/^#[0-9a-fA-F]{6}$/, { message: 'Color en formato #RRGGBB' })
  colorPrimario!: string;

  @Matches(/^#[0-9a-fA-F]{6}$/, { message: 'Color en formato #RRGGBB' })
  colorAcento!: string;
}

export class ActualizarOpcionesGlobalesDto {
  @Transform(limpiar) @Length(0, 180)
  mensajeBienvenida!: string;
  @IsIn(['NORMAL', 'GRANDE'])
  tamanoLogo!: 'NORMAL' | 'GRANDE';
}
export interface MarcaPublicaDto {
  nombreAdministrativo: string;
  nombrePortalAlumno: string;
  nombreInstitucion: string;
  nombreCorto: string;
  logoUrl: string | null;
  colorPrimario: string;
  colorPrimarioOscuro: string;
  colorAcento: string;
  mensajeBienvenida: string;
  tamanoLogo: 'NORMAL' | 'GRANDE';
  actualizadoEn: Date;
}
