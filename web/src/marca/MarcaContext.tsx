import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import { api } from '../api/client';

export type Marca = {
  nombreInstitucion: string;
  nombreCorto: string;
  logoUrl: string | null;
  colorPrimario: string;
  colorPrimarioOscuro: string;
  colorAcento: string;
  actualizadoEn: string;
};

export const MARCA_POR_DEFECTO: Marca = {
  nombreInstitucion: 'Sistema Escolar', nombreCorto: 'SE', logoUrl: null,
  colorPrimario: '#14343B', colorPrimarioOscuro: '#0E262B', colorAcento: '#C79A3C', actualizadoEn: '',
};

export function contrasteAA(fondo: string, texto: string): number {
  const canal = (valor: number): number => {
    const normalizado = valor / 255;
    return normalizado <= 0.04045 ? normalizado / 12.92 : ((normalizado + 0.055) / 1.055) ** 2.4;
  };
  const luminancia = (hex: string): number => {
    if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return 0;
    const canales = [1, 3, 5].map((pos) => canal(Number.parseInt(hex.slice(pos, pos + 2), 16)));
    return 0.2126 * canales[0] + 0.7152 * canales[1] + 0.0722 * canales[2];
  };
  const a = luminancia(fondo);
  const b = luminancia(texto);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

export function textoAccesible(fondo: string): '#ffffff' | '#19272c' | '#000000' {
  if (contrasteAA(fondo, '#ffffff') >= 4.5) return '#ffffff';
  return contrasteAA(fondo, '#19272c') >= 4.5 ? '#19272c' : '#000000';
}

const MarcaContext = createContext<{ marca: Marca; recargar: () => Promise<void> } | null>(null);

function aplicarMarca(marca: Marca) {
  const raiz = document.documentElement.style;
  raiz.setProperty('--pizarra', marca.colorPrimario);
  raiz.setProperty('--pizarra-2', marca.colorPrimarioOscuro);
  raiz.setProperty('--dorado', marca.colorAcento);
  raiz.setProperty('--texto-sobre-pizarra', textoAccesible(marca.colorPrimario));
  raiz.setProperty('--texto-sobre-pizarra-2', textoAccesible(marca.colorPrimarioOscuro));
  raiz.setProperty('--texto-sobre-dorado', textoAccesible(marca.colorAcento));
  document.title = `${marca.nombreInstitucion} — Panel`;
}

export function MarcaProvider({ children }: { children: ReactNode }) {
  const [marca, setMarca] = useState(MARCA_POR_DEFECTO);
  const recargar = useCallback(async () => {
    try {
      const { data } = await api.get<Marca>('/configuracion/marca');
      setMarca(data);
      aplicarMarca(data);
    } catch {
      aplicarMarca(MARCA_POR_DEFECTO);
    }
  }, []);
  useEffect(() => { void recargar(); }, [recargar]);
  return <MarcaContext.Provider value={{ marca, recargar }}>{children}</MarcaContext.Provider>;
}

export function useMarca() {
  const contexto = useContext(MarcaContext);
  if (!contexto) throw new Error('useMarca debe usarse dentro de MarcaProvider');
  return contexto;
}
