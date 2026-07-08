import { createContext, useContext } from 'react';

export interface Sesion {
  sub: number;
  email: string;
  nombre: string;
  roles: string[];
}

export interface SesionContexto {
  sesion: Sesion | null;
  iniciar: (email: string, password: string) => Promise<void>;
  cerrar: () => Promise<void>;
}

export const SesionContext = createContext<SesionContexto>(null as unknown as SesionContexto);
export const useSesion = () => useContext(SesionContext);
