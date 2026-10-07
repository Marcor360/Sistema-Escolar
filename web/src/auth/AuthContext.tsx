import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { api, establecerToken, renovarSesion, mensajeDeError, registrarSesionExpirada } from '../api/client';

export interface Sesion {
  sub: number;
  email: string;
  nombre: string;
  roles: string[];
  passwordChangeRequired?: boolean;
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
    localStorage.removeItem('token'); localStorage.removeItem('sesion');
    renovarSesion().then(() => api.get<{
      id: number; email: string; nombreCompleto: string; roles: { clave: string }[]; passwordChangeRequired: boolean;
    }>('/auth/me')).then(({ data }) => {
      if (!activo) return;
      const actual: Sesion = {
        sub: data.id, email: data.email, nombre: data.nombreCompleto,
        roles: data.roles.map((rol) => rol.clave), passwordChangeRequired: data.passwordChangeRequired,
      };

      setSesion(actual);
    }).catch((error: { response?: { status?: number } }) => {
      if (!activo) return;
      localStorage.removeItem('sesion');
      if (error.response?.status === 401 || error.response?.status === 403) {
        localStorage.removeItem('token');
      } else {
        setErrorInicio(true);
      }
    }).finally(() => { if (activo) setCargando(false); });
    return () => { activo = false; };
  }, []);

  useEffect(() => { registrarSesionExpirada(() => setSesion(null)); return () => registrarSesionExpirada(null); }, []);

  const login = async (email: string, password: string) => {
    const { data } = await api.post('/auth/login', { email, password });
    establecerToken(data.accessToken);

    setSesion(data.usuario);
  };

  const logout = async () => {
    await api.post('/auth/logout');
    establecerToken(null); setSesion(null);
  };

  const tieneRol = (...roles: string[]) =>
    sesion !== null &&
    (sesion.roles.includes('SUPERADMIN') || roles.some((r) => sesion.roles.includes(r)));

  return (
    <AuthContext.Provider value={{ sesion, cargando, errorInicio, login, logout, tieneRol }}>
      {sesion?.passwordChangeRequired ? <CambiarTemporal alCambiar={() => { establecerToken(null); setSesion(null); }} /> : children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

function CambiarTemporal({ alCambiar }: { alCambiar: () => void }) {
  const [actual, setActual] = useState(''); const [nueva, setNueva] = useState('');
  const [error, setError] = useState(''); const [enviando, setEnviando] = useState(false);
  return <main className="panel"><h1>Cambia tu contraseña temporal</h1><p>Para proteger tu cuenta, elige una contraseña nueva antes de continuar.</p>
    <form onSubmit={async (e) => { e.preventDefault(); if (enviando) return; setEnviando(true); setError('');
      try { await api.post('/auth/cambiar-password', { actual, nueva }); alCambiar(); }
      catch (err) { setError(mensajeDeError(err)); } finally { setEnviando(false); }
    }}>
      <label htmlFor="temporal">Contraseña temporal</label><input id="temporal" type="password" required autoComplete="current-password" value={actual} onChange={(e) => setActual(e.target.value)} />
      <label htmlFor="nueva">Nueva contraseña</label><input id="nueva" type="password" required minLength={8} autoComplete="new-password" value={nueva} onChange={(e) => setNueva(e.target.value)} />
      <button disabled={enviando}>Cambiar contraseña y volver a iniciar sesión</button>{error && <p role="alert">{error}</p>}
    </form></main>;
}
