import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { api } from '../api/client';

export interface Sesion {
  sub: number;
  email: string;
  nombre: string;
  roles: string[];
}

interface AuthValue {
  sesion: Sesion | null;
  cargando: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  tieneRol: (...roles: string[]) => boolean;
}

const AuthContext = createContext<AuthValue>(null as unknown as AuthValue);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [sesion, setSesion] = useState<Sesion | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    const guardada = localStorage.getItem('sesion');
    if (guardada && localStorage.getItem('token')) setSesion(JSON.parse(guardada));
    setCargando(false);
  }, []);

  const login = async (email: string, password: string) => {
    const { data } = await api.post('/auth/login', { email, password });
    localStorage.setItem('token', data.accessToken);
    localStorage.setItem('sesion', JSON.stringify(data.usuario));
    setSesion(data.usuario);
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('sesion');
    setSesion(null);
  };

  const tieneRol = (...roles: string[]) =>
    sesion !== null &&
    (sesion.roles.includes('SUPERADMIN') || roles.some((r) => sesion.roles.includes(r)));

  return (
    <AuthContext.Provider value={{ sesion, cargando, login, logout, tieneRol }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
