import { createContext, useContext } from 'react';

export type Marca = {
  nombreAdministrativo?: string;
  nombrePortalAlumno?: string;
  nombreInstitucion: string;
  nombreCorto: string;
  logoUrl: string | null;
  faviconAlumnoUrl?: string | null;
  logoAlumnoUrl?: string | null;
  tamanoLogo?: 'NORMAL' | 'GRANDE';
  colorPrimario: string;
  colorPrimarioOscuro: string;
  colorAcento: string;
  fondoAlumnoUrl?: string | null;
  bienvenidaAlumno?: string | null;
  descripcionAlumno?: string | null;
  avisoAlumno?: string | null;
  contactoAlumno?: string | null;
  privacidadAlumno?: string | null;
  reglamentoAlumno?: string | null;
  sitioAlumno?: string | null;
  actualizadoEn: string;
};

export const MARCA_CACHE_KEY = 'escolar_marca';
export const MARCA_POR_DEFECTO: Marca = {
  nombreAdministrativo: 'Sistema Escolar Administrativo', nombrePortalAlumno: 'Sistema Escolar Portal Alumno',
  nombreInstitucion: 'Sistema Escolar', nombreCorto: 'SE', logoUrl: null, faviconAlumnoUrl: null, logoAlumnoUrl: null,
  colorPrimario: '#14343B', colorPrimarioOscuro: '#0E262B', colorAcento: '#C79A3C', actualizadoEn: '',
};

export const MarcaContext = createContext<{ marca: Marca }>({ marca: MARCA_POR_DEFECTO });
export const useMarca = () => useContext(MarcaContext);
