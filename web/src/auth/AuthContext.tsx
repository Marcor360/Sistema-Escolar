import { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { api, establecerToken, obtenerTokenSesion, renovarSesion, mensajeDeError, registrarSesionExpirada } from '../api/client';
import { CLAVE_ACTIVIDAD, CLAVE_CIERRE, LIMITE_INACTIVIDAD_MS, cierreLocalActivo, guardarUltimaActividad, iniciarActividadAutenticada, inactividadVencida, leerUltimaActividad, registrarCierreLocal } from './inactividad';

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
  finalizarSesionLocal: () => void;
  tieneRol: (...roles: string[]) => boolean;
}

const AuthContext = createContext<AuthValue>(null as unknown as AuthValue);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [sesion, setSesion] = useState<Sesion | null>(null);
  const [cargando, setCargando] = useState(true);
  const [errorInicio, setErrorInicio] = useState(false);
  const usuarioSesion = sesion?.sub;
  const revocacion = useRef<Promise<void>>(Promise.resolve());
  const cancelarRevocacion = useRef<AbortController | null>(null);

  useEffect(() => {
    let activo = true;
    localStorage.removeItem('token'); localStorage.removeItem('sesion');
    const ultima = leerUltimaActividad();
    if (cierreLocalActivo() || (ultima !== null && inactividadVencida(ultima, Date.now()))) {
      if (!cierreLocalActivo()) registrarCierreLocal('inactividad');
      setCargando(false);
      return;
    }
    renovarSesion().then(() => api.get<{
      id: number; email: string; nombreCompleto: string; roles: { clave: string }[]; passwordChangeRequired: boolean;
    }>('/auth/me')).then(({ data }) => {
      if (!activo || cierreLocalActivo()) return;
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
    // Un refresh de logout antiguo no debe sobrescribir la cookie del login nuevo.
    cancelarRevocacion.current?.abort();
    await revocacion.current;
    const { data } = await api.post('/auth/login', { email, password });
    iniciarActividadAutenticada();
    establecerToken(data.accessToken);
    setSesion(data.usuario);
  };

  const cerrarLocal = (motivo: 'manual' | 'inactividad') => {
    registrarCierreLocal(motivo);
    establecerToken(null);
    setSesion(null);
  };

  const finalizarSesionLocal = () => cerrarLocal('manual');

  // Revocación de mejor esfuerzo: el cierre local no depende de que la red responda.
  const revocarDispositivo = (token: string | null) => {
    if (!token || typeof fetch !== 'function') return;
    // Tras 30 minutos el access (15m) ya expiró: rotar solo para revocar la sesión.
    const control = new AbortController();
    cancelarRevocacion.current?.abort();
    cancelarRevocacion.current = control;
    revocacion.current = (async () => {
      const url = api.defaults.baseURL;
      const sesionDelToken = (acceso: string): string | null => {
        try {
          const cuerpo = acceso.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
          const payload: unknown = JSON.parse(atob(cuerpo));
          return typeof payload === 'object' && payload !== null &&
            'sid' in payload && typeof payload.sid === 'string' ? payload.sid : null;
        } catch { return null; }
      };
      const sidAnterior = sesionDelToken(token);
      const retirar = (acceso: string) => fetch(`${url}/auth/logout`, {
        method: 'POST', credentials: 'include', keepalive: true, signal: control.signal,
        headers: { Authorization: `Bearer ${acceso}`, 'x-portal': 'WEB' },
      });
      const intento = await retirar(token);
      if (intento.status !== 401 || !cierreLocalActivo()) return;
      const nuevo = await fetch(`${url}/auth/refresh`, {
        method: 'POST', credentials: 'include', keepalive: true, signal: control.signal,
        headers: { 'x-portal': 'WEB', 'Content-Type': 'application/json' },
        body: '{}',
      });
      if (!nuevo.ok) return;
      const datos: { accessToken?: string } = await nuevo.json();
      // Una autenticación manual nueva no puede ser revocada por un logout tardío.
      if (datos.accessToken && sidAnterior && sesionDelToken(datos.accessToken) === sidAnterior &&
          cierreLocalActivo()) await retirar(datos.accessToken);
    })().catch(() => undefined).finally(() => {
      if (cancelarRevocacion.current === control) cancelarRevocacion.current = null;
    });
  };

  const logout = async () => {
    const token = obtenerTokenSesion();
    finalizarSesionLocal();
    revocarDispositivo(token);
  };

  useEffect(() => {
    if (!usuarioSesion) return;
    let cerrada = false;
    let ultimo = leerUltimaActividad() ?? Date.now();
    let ultimaPersistida = ultimo;
    let ultimoEnvioActividad = 0;
    let temporizador: ReturnType<typeof setTimeout> | undefined;
    if (leerUltimaActividad() === null) guardarUltimaActividad(ultimo);

    const vencer = () => {
      if (cerrada) return;
      cerrada = true;
      const token = obtenerTokenSesion();
      cerrarLocal('inactividad');
      revocarDispositivo(token);
    };
    const comprobar = () => {
      if (cerrada) return;
      const compartida = leerUltimaActividad();
      if (compartida !== null && compartida > ultimo) ultimo = compartida;
      if (inactividadVencida(ultimo, Date.now())) { vencer(); return; }
      if (temporizador) clearTimeout(temporizador);
      temporizador = setTimeout(comprobar, LIMITE_INACTIVIDAD_MS - (Date.now() - ultimo));
    };
    const actividad = () => {
      if (cerrada) return;
      const ahora = Date.now();
      if (inactividadVencida(ultimo, ahora)) { comprobar(); return; }
      ultimo = ahora;
      if (ahora - ultimoEnvioActividad >= 60_000) {
        ultimoEnvioActividad = ahora;
        void api.post('/auth/actividad').catch(() => undefined);
      }
      if (ahora - ultimaPersistida >= 5000) {
        ultimaPersistida = ahora;
        guardarUltimaActividad(ahora);
      }
    };
    const almacen = (evento: StorageEvent) => {
      if (evento.key === CLAVE_CIERRE && evento.newValue !== null) {
        cerrada = true;
        if (temporizador) clearTimeout(temporizador);
        establecerToken(null);
        setSesion(null);
      } else if (evento.key === CLAVE_ACTIVIDAD && evento.newValue) {
        const fecha = Number(evento.newValue);
        if (Number.isFinite(fecha) && fecha <= Date.now() && fecha > ultimo) ultimo = fecha;
      }
    };
    const reanudar = () => { if (!document.hidden) comprobar(); };
    const eventos = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart'] as const;
    for (const nombre of eventos) window.addEventListener(nombre, actividad, { passive: true });
    window.addEventListener('storage', almacen);
    window.addEventListener('focus', comprobar);
    document.addEventListener('visibilitychange', reanudar);
    comprobar();
    return () => {
      cerrada = true;
      if (temporizador) clearTimeout(temporizador);
      for (const nombre of eventos) window.removeEventListener(nombre, actividad);
      window.removeEventListener('storage', almacen);
      window.removeEventListener('focus', comprobar);
      document.removeEventListener('visibilitychange', reanudar);
    };
  }, [usuarioSesion]);

  const tieneRol = (...roles: string[]) =>
    sesion !== null &&
    (sesion.roles.includes('SUPERADMIN') || roles.some((r) => sesion.roles.includes(r)));

  return (
    <AuthContext.Provider value={{ sesion, cargando, errorInicio, login, logout, finalizarSesionLocal, tieneRol }}>
      {sesion?.passwordChangeRequired ? <CambiarTemporal alCambiar={finalizarSesionLocal} /> : children}
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
