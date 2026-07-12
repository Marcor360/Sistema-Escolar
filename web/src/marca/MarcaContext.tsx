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

const MarcaContext = createContext<{ marca: Marca; recargar: () => Promise<void> } | null>(null);

function aplicarMarca(marca: Marca) {
  const raiz = document.documentElement.style;
  raiz.setProperty('--pizarra', marca.colorPrimario);
  raiz.setProperty('--pizarra-2', marca.colorPrimarioOscuro);
  raiz.setProperty('--dorado', marca.colorAcento);
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
