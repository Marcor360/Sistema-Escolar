import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { api } from '../api/client';

export type Marca = {
  nombreAdministrativo?: string;
  nombrePortalAlumno?: string;
  nombreInstitucion: string;
  nombreCorto: string;
  logoUrl: string | null;
  colorPrimario: string;
  colorPrimarioOscuro: string;
  colorAcento: string;
  mensajeBienvenida: string;
  tamanoLogo: 'NORMAL' | 'GRANDE';
  actualizadoEn: string;
};

export const MARCA_POR_DEFECTO: Marca = {
  nombreAdministrativo: 'Sistema Escolar Administrativo', nombrePortalAlumno: 'Sistema Escolar Portal Alumno',
  nombreInstitucion: 'Sistema Escolar', nombreCorto: 'SE', logoUrl: null,
  colorPrimario: '#14343B', colorPrimarioOscuro: '#0E262B', colorAcento: '#C79A3C', mensajeBienvenida: '', tamanoLogo: 'NORMAL', actualizadoEn: '',
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

export const MARCA_CACHE_WEB = 'escolar_marca_publica_v1';
const MARCA_INTERVALO_MS = 60_000;

/** Únicamente la identidad pública, sin cuentas ni sesiones, puede almacenarse en el navegador. */
export function esMarcaWebValida(valor: unknown): valor is Marca {
  if (!valor || typeof valor !== 'object') return false;
  const datos = valor as Partial<Marca>;
  return typeof datos.nombreInstitucion === 'string' && datos.nombreInstitucion.trim().length > 0
    && typeof datos.nombreCorto === 'string' && datos.nombreCorto.trim().length > 0
    && [datos.colorPrimario, datos.colorPrimarioOscuro, datos.colorAcento].every(
      (color) => typeof color === 'string' && /^#[a-f0-9]{6}$/i.test(color),
    )
    && (datos.logoUrl === null || (typeof datos.logoUrl === 'string'
      && /^\/uploads\/marca-logo-[0-9a-f-]+\.(png|jpe?g|webp)$/i.test(datos.logoUrl)))
    && (datos.mensajeBienvenida === undefined || typeof datos.mensajeBienvenida === 'string')
    && (datos.tamanoLogo === undefined || ['NORMAL', 'GRANDE'].includes(datos.tamanoLogo))
    && typeof datos.actualizadoEn === 'string';
}

function leerMarcaGuardada(): Marca | null {
  try {
    const guardada = localStorage.getItem(MARCA_CACHE_WEB);
    if (!guardada) return null;
    const valor: unknown = JSON.parse(guardada);
    return esMarcaWebValida(valor) ? valor : null;
  } catch { return null; }
}

function marcaIgual(anterior: Marca, siguiente: Marca): boolean {
  return anterior.nombreAdministrativo === siguiente.nombreAdministrativo
    && anterior.nombrePortalAlumno === siguiente.nombrePortalAlumno
    && anterior.nombreInstitucion === siguiente.nombreInstitucion
    && anterior.nombreCorto === siguiente.nombreCorto
    && anterior.logoUrl === siguiente.logoUrl
    && anterior.colorPrimario === siguiente.colorPrimario
    && anterior.colorPrimarioOscuro === siguiente.colorPrimarioOscuro
    && anterior.colorAcento === siguiente.colorAcento
    && anterior.mensajeBienvenida === siguiente.mensajeBienvenida
    && anterior.tamanoLogo === siguiente.tamanoLogo
    && anterior.actualizadoEn === siguiente.actualizadoEn;
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
  document.title = document.querySelector('[data-portal-sistema="ALUMNO"]') ? marca.nombrePortalAlumno || 'Sistema Escolar Portal Alumno' : marca.nombreAdministrativo || 'Sistema Escolar Administrativo';
}

export function MarcaProvider({ children }: { children: ReactNode }) {
  const [marca, setMarca] = useState<Marca>(() => leerMarcaGuardada() ?? MARCA_POR_DEFECTO);
  const consultaActual = useRef<Promise<void> | null>(null);

  const usarMarca = useCallback((nueva: Marca) => {
    if (!esMarcaWebValida(nueva)) return;
    setMarca((actual) => marcaIgual(actual, nueva) ? actual : nueva);
    aplicarMarca(nueva);
  }, []);

  const recargar = useCallback((): Promise<void> => {
    if (consultaActual.current) return consultaActual.current;
    const consulta = api.get<Marca>('/configuracion/marca')
      .then(({ data }) => {
        if (!esMarcaWebValida(data)) throw new Error('La identidad recibida no es válida');
        usarMarca(data);
        try {
          const serializada = JSON.stringify(data);
          if (localStorage.getItem(MARCA_CACHE_WEB) !== serializada) localStorage.setItem(MARCA_CACHE_WEB, serializada);
        } catch { /* Almacenamiento no disponible. */ }
      })
      .finally(() => { if (consultaActual.current === consulta) consultaActual.current = null; });
    consultaActual.current = consulta;
    return consulta;
  }, [usarMarca]);

  useEffect(() => { aplicarMarca(marca); }, [marca]);

  useEffect(() => {
    void recargar().catch(() => undefined);
    const actualizarSiVisible = () => {
      if (document.visibilityState === 'visible') void recargar().catch(() => undefined);
    };
    const recibirCache = (evento: StorageEvent) => {
      if (evento.key !== MARCA_CACHE_WEB || !evento.newValue) return;
      try {
        const valor: unknown = JSON.parse(evento.newValue);
        if (esMarcaWebValida(valor)) usarMarca(valor);
      } catch { /* No sustituir identidad válida por caché dañada. */ }
    };
    document.addEventListener('visibilitychange', actualizarSiVisible);
    window.addEventListener('focus', actualizarSiVisible);
    window.addEventListener('online', actualizarSiVisible);
    window.addEventListener('storage', recibirCache);
    const intervalo = window.setInterval(actualizarSiVisible, MARCA_INTERVALO_MS);
    return () => {
      window.clearInterval(intervalo);
      document.removeEventListener('visibilitychange', actualizarSiVisible);
      window.removeEventListener('focus', actualizarSiVisible);
      window.removeEventListener('online', actualizarSiVisible);
      window.removeEventListener('storage', recibirCache);
    };
  }, [recargar, usarMarca]);

  return <MarcaContext.Provider value={{ marca, recargar }}>{children}</MarcaContext.Provider>;
}

export function useMarca() {
  const contexto = useContext(MarcaContext);
  if (!contexto) throw new Error('useMarca debe usarse dentro de MarcaProvider');
  return contexto;
}
