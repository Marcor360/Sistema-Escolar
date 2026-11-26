import { OpcionalNoNulo } from '../common/opcional-no-nulo';
import { Transform } from 'class-transformer';
const limpiar = ({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value;
import { IsIn, IsUrl, ValidateIf, Length, Matches } from 'class-validator';

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
  @OpcionalNoNulo() @Transform(limpiar) @Length(0, 180) bienvenidaAlumno?: string;
  @OpcionalNoNulo() @Transform(limpiar) @Length(0, 420) descripcionAlumno?: string;
  @OpcionalNoNulo() @Transform(limpiar) @Length(0, 360) avisoAlumno?: string;
  @OpcionalNoNulo() @Transform(limpiar) @Length(0, 180) contactoAlumno?: string;
  @OpcionalNoNulo() @Transform(limpiar) @Length(0, 500) @ValidateIf((_obj, value) => value !== '') @IsUrl({ protocols: ['https'], require_protocol: true, disallow_auth: true }) privacidadAlumno?: string;
  @OpcionalNoNulo() @Transform(limpiar) @Length(0, 500) @ValidateIf((_obj, value) => value !== '') @IsUrl({ protocols: ['https'], require_protocol: true, disallow_auth: true }) reglamentoAlumno?: string;
  @OpcionalNoNulo() @Transform(limpiar) @Length(0, 500) @ValidateIf((_obj, value) => value !== '') @IsUrl({ protocols: ['https'], require_protocol: true, disallow_auth: true }) sitioAlumno?: string;
  @OpcionalNoNulo() @Transform(limpiar) @Length(0, 120) tituloBoleta?: string;
  @OpcionalNoNulo() @Transform(limpiar) @Length(0, 480) pieBoleta?: string;
  @IsIn(['NORMAL', 'GRANDE'])
  tamanoLogo!: 'NORMAL' | 'GRANDE';
}
export interface MarcaPublicaDto {
  nombreAdministrativo: string;
  nombrePortalAlumno: string;
  nombreInstitucion: string;
  nombreCorto: string;
  logoUrl: string | null;
  faviconAdministrativoUrl: string | null;
  faviconAlumnoUrl: string | null;
  logoAlumnoUrl: string | null;
  colorPrimario: string;
  colorPrimarioOscuro: string;
  colorAcento: string;
  mensajeBienvenida: string;
  tamanoLogo: 'NORMAL' | 'GRANDE';
  tituloBoleta?: string | null;
  pieBoleta?: string | null;
  fondoAlumnoUrl?: string | null;
  bienvenidaAlumno?: string | null;
  descripcionAlumno?: string | null;
  avisoAlumno?: string | null;
  contactoAlumno?: string | null;
  privacidadAlumno?: string | null;
  reglamentoAlumno?: string | null;
  sitioAlumno?: string | null;
  actualizadoEn: Date;
}
