import { createContext, useContext } from 'react';
import { colores } from './theme';

export type Marca = {
  nombreInstitucion: string;
  nombreCorto: string;
  logoUrl: string | null;
  colorPrimario: string;
  colorPrimarioOscuro: string;
  colorAcento: string;
  actualizadoEn: string;
};

export const MARCA_CACHE_KEY = 'escolar_marca';
export const MARCA_POR_DEFECTO: Marca = {
  nombreInstitucion: 'Sistema Escolar', nombreCorto: 'SE', logoUrl: null,
  colorPrimario: '#14343B', colorPrimarioOscuro: '#0E262B', colorAcento: '#C79A3C', actualizadoEn: '',
};

export function aplicarColores(marca: Marca) {
  Object.assign(colores, {
    pizarra: marca.colorPrimario,
    pizarraOscuro: marca.colorPrimarioOscuro,
    dorado: marca.colorAcento,
  });
}

export const MarcaContext = createContext<{ marca: Marca }>({ marca: MARCA_POR_DEFECTO });
export const useMarca = () => useContext(MarcaContext);
