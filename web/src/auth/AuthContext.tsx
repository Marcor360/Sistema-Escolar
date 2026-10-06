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
  errorInicio: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  tieneRol: (...roles: string[]) => boolean;
}

const AuthContext = createContext<AuthValue>(null as unknown as AuthValue);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [sesion, setSesion] = useState<Sesion | null>(null);
  const [cargando, setCargando] = useState(true);
  const [errorInicio, setErrorInicio] = useState(false);

  useEffect(() => {
    let activo = true;
    if (!localStorage.getItem('token')) {
      localStorage.removeItem('sesion');
      setCargando(false);
      return;
    }
    api.get<{
      id: number; email: string; nombreCompleto: string; roles: { clave: string }[];
    }>('/auth/me').then(({ data }) => {
      if (!activo) return;
      const actual: Sesion = {
        sub: data.id, email: data.email, nombre: data.nombreCompleto,
        roles: data.roles.map((rol) => rol.clave),
      };
      localStorage.setItem('sesion', JSON.stringify(actual));
      setSesion(actual);
    }).catch((error: { response?: { status?: number } }) => {
      if (!activo) return;
      localStorage.removeItem('sesion');
      if (error.response?.status === 401) {
        localStorage.removeItem('token');
      } else {
        setErrorInicio(true);
      }
    }).finally(() => { if (activo) setCargando(false); });
    return () => { activo = false; };
  }, []);

  const login = async (email: string, password: string) => {
    const { data } = await api.post('/auth/login', { email, password });
    localStorage.setItem('token', data.accessToken);
    localStorage.setItem('sesion', JSON.stringify(data.usuario));
    setSesion(data.usuario);
  };

  const logout = async () => {
    await api.post('/auth/logout');
    localStorage.removeItem('token');
    localStorage.removeItem('sesion');
    setSesion(null);
  };

  const tieneRol = (...roles: string[]) =>
    sesion !== null &&
    (sesion.roles.includes('SUPERADMIN') || roles.some((r) => sesion.roles.includes(r)));

  return (
    <AuthContext.Provider value={{ sesion, cargando, errorInicio, login, logout, tieneRol }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
