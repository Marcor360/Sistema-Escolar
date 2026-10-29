import { FormEvent, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { api, archivosBase, mensajeDeError } from '../api/client';
import { useMarca } from '../marca/MarcaContext';
import { CLAVE_CIERRE } from '../auth/inactividad';

type Modo = 'entrar' | 'solicitar' | 'restablecer' | 'activar-solicitar' | 'activar-codigo';

export default function LoginPage() {
  const { login } = useAuth();
  const { marca } = useMarca();
  const navigate = useNavigate();
  const location = useLocation();
  const solicitudEnCurso = useRef(false);
  const [modo, setModo] = useState<Modo>('entrar');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [token, setToken] = useState('');
  const [nueva, setNueva] = useState('');
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState(() => {
    const mensaje = (location.state as { aviso?: unknown } | null)?.aviso;
    return typeof mensaje === 'string' ? mensaje : '';
  });
  const [enviando, setEnviando] = useState(false);
  const [logoFallo, setLogoFallo] = useState(false);
  useEffect(() => setLogoFallo(false), [marca.logoUrl]);

  const limpiar = () => { setError(''); setAviso(''); };

  const entrar = async (e: FormEvent) => {
    e.preventDefault();
    if (solicitudEnCurso.current) return;
    solicitudEnCurso.current = true;
    limpiar();
    setEnviando(true);
    try {
      await login(email.trim(), password);
      navigate('/');
    } catch (err) {
      setError(mensajeDeError(err));
    } finally {
      solicitudEnCurso.current = false;
      setEnviando(false);
    }
  };

  const solicitar = async (e: FormEvent) => {
    e.preventDefault();
    if (solicitudEnCurso.current) return;
    solicitudEnCurso.current = true;
    limpiar();
    setEnviando(true);
    try {
      const { data } = await api.post('/auth/forgot-password', { email:email.trim() });
      setAviso(`${data.mensaje}. Copia el código del correo y captúralo abajo.`);
      setModo('restablecer');
    } catch (err) {
      setError(mensajeDeError(err));
    } finally {
      solicitudEnCurso.current = false;
      setEnviando(false);
    }
  };

  const restablecer = async (e: FormEvent) => {
    e.preventDefault();
    if (solicitudEnCurso.current) return;
    solicitudEnCurso.current = true;
    limpiar();
    setEnviando(true);
    try {
      await api.post('/auth/reset-password', { token: token.trim(), password: nueva });
      setAviso('Contraseña restablecida. Ya puedes iniciar sesión.');
      setModo('entrar');
      setPassword(''); setToken(''); setNueva('');
    } catch (err) {
      setError(mensajeDeError(err));
    } finally {
      solicitudEnCurso.current = false;
      setEnviando(false);
    }
  };

  const activacionEnCurso = useRef(false);
  const pedirActivacion = async (e: FormEvent) => {
    e.preventDefault();
    if (activacionEnCurso.current) return;
    activacionEnCurso.current = true;
    limpiar(); setEnviando(true);
    try {
      const { data } = await api.post<{ mensaje: string }>('/auth/solicitar-activacion', { email:email.trim() });
      setAviso(data.mensaje);
      setModo('activar-codigo');
    } catch (err) { setError(mensajeDeError(err)); }
    finally { activacionEnCurso.current = false; setEnviando(false); }
  };

  const activarCuenta = async (e: FormEvent) => {
    e.preventDefault();
    if (activacionEnCurso.current) return;
    activacionEnCurso.current = true;
    limpiar(); setEnviando(true);
    try {
      const { data } = await api.post<{ mensaje: string }>('/auth/activar-cuenta', { token: token.trim(), password: nueva });
      setAviso(data.mensaje); setToken(''); setNueva(''); setPassword(''); setModo('entrar');
    } catch (err) { setError(mensajeDeError(err)); }
    finally { activacionEnCurso.current = false; setEnviando(false); }
  };

  return (
    <div className="login-fondo">
      <div className={`login-caja${marca.tamanoLogo === 'GRANDE' ? ' logo-amplio' : ''}`}>
        {marca.logoUrl && !logoFallo
          ? <img className="logo-marca" src={archivosBase + marca.logoUrl} alt={marca.nombreInstitucion} onError={() => setLogoFallo(true)} />
          : <div className="monograma" aria-hidden>{marca.nombreCorto}</div>}
        <h1>{marca.nombreAdministrativo || 'Sistema Escolar Administrativo'}</h1><p>{marca.nombreInstitucion}</p>
        {marca.mensajeBienvenida && <p className="texto-ayuda" role="note">{marca.mensajeBienvenida}</p>}
        {localStorage.getItem(CLAVE_CIERRE) === 'inactividad' && (
          <p role="status" className="mensaje-ok">La sesión se cerró tras 30 minutos sin actividad. Inicia sesión nuevamente.</p>
        )}

        {modo === 'entrar' && (
          <form onSubmit={entrar}>
            <div className="campo">
              <label htmlFor="email">Correo institucional</label>
              <input disabled={enviando} id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
            </div>
            <div className="campo">
              <label htmlFor="password">Contraseña</label>
              <input disabled={enviando} id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            {error && <p className="mensaje-error" role="alert">{error}</p>}
            {aviso && <p className="mensaje-ok" role="status">{aviso}</p>}
            <button className="boton" style={{ width: '100%' }} disabled={enviando}>
              {enviando ? 'Verificando…' : 'Entrar'}
            </button>
            <button type="button" className="enlace" disabled={enviando} onClick={() => { limpiar(); setToken(''); setNueva(''); setModo('solicitar'); }}>
              ¿Olvidaste tu contraseña?
            </button>
            <button type="button" className="enlace" disabled={enviando} onClick={() => { limpiar(); setModo('activar-solicitar'); }}>
              Activar mi cuenta por primera vez
            </button>
          </form>
        )}

        {modo === 'solicitar' && (
          <form onSubmit={solicitar}>
            <h2>Recuperar contraseña · Paso 1 de 2</h2>
            <p className="detalle" style={{ marginTop: 0 }}>
              Si la cuenta existe y el servicio de correo está disponible, recibirás un código que vence en 1 hora. Revisa Correo no deseado y que escribiste tu dirección correctamente. Si no tienes acceso a ese correo, contacta a Control escolar.
            </p>
            <div className="campo">
              <label htmlFor="email-rec">Correo institucional</label>
              <input disabled={enviando} id="email-rec" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
            </div>
            {error && <p className="mensaje-error" role="alert">{error}</p>}
            <button className="boton" style={{ width: '100%' }} disabled={enviando}>
              {enviando ? 'Enviando…' : 'Enviar código'}
            </button>
            <button type="button" className="enlace" disabled={enviando} onClick={() => { limpiar(); setToken(''); setNueva(''); setModo('entrar'); }}>
              Volver a iniciar sesión
            </button>
          </form>
        )}

        {modo === 'activar-solicitar' && (
          <form onSubmit={pedirActivacion}><fieldset disabled={enviando} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
            <p className="detalle">La matrícula no es una contraseña. Solicita un código privado a tu correo institucional para establecer tu contraseña.</p>
            <div className="campo">
              <label htmlFor="activar-email">Correo institucional del alumno</label>
              <input disabled={enviando} id="activar-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
            </div>
            {error && <p role="alert" className="mensaje-error">{error}</p>}
            <button className="boton" disabled={enviando}>{enviando ? 'Solicitando…' : 'Solicitar código de activación'}</button>
            <button type="button" className="enlace" disabled={enviando} onClick={() => { limpiar(); setToken(''); setNueva(''); setModo('entrar'); }}>Volver al inicio</button>
          </fieldset></form>
        )}
        {modo === 'activar-codigo' && (
          <form onSubmit={activarCuenta}><fieldset disabled={enviando} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
            <p className="detalle">Si el correo está disponible, recibirás un código válido durante una hora. Revisa Correo no deseado y que escribiste tu dirección correctamente. Si no tienes acceso a ese correo, contacta a Control escolar.</p>
            {aviso && <p role="status" className="mensaje-ok">{aviso}</p>}
            <div className="campo">
              <label htmlFor="activar-token">Código de activación (64 caracteres)</label>
              <input disabled={enviando} id="activar-token" value={token} maxLength={64} autoComplete="off" autoCapitalize="off" onChange={(e) => setToken(e.target.value.trim().toLowerCase())} required />
            </div>
            <div className="campo">
              <label htmlFor="activar-pass">Nueva contraseña (mínimo 8 caracteres)</label>
              <input disabled={enviando} id="activar-pass" type="password" autoComplete="new-password" value={nueva} onChange={(e) => setNueva(e.target.value)} minLength={8} required />
            </div>
            {error && <p role="alert" className="mensaje-error">{error}</p>}
            <button className="boton" disabled={enviando || token.length !== 64}>{enviando ? 'Activando…' : 'Activar mi cuenta'}</button>
            <button type="button" className="enlace" disabled={enviando} onClick={() => { limpiar(); setToken(''); setNueva(''); setModo('activar-solicitar'); }}>Solicitar otro código</button>
            <button type="button" className="enlace" disabled={enviando} onClick={() => { limpiar(); setToken(''); setNueva(''); setModo('entrar'); }}>Volver al inicio</button>
          </fieldset></form>
        )}

        {modo === 'restablecer' && (
          <form onSubmit={restablecer}>
            <h2>Crear nueva contraseña · Paso 2 de 2</h2>
            {aviso && <p className="mensaje-ok" role="status" style={{ marginTop: 0 }}>{aviso}</p>}
            <div className="campo">
              <label htmlFor="token">Código de recuperación</label>
              <input disabled={enviando} id="token" value={token} maxLength={32} autoComplete="off" autoCapitalize="off" spellCheck={false} aria-describedby="ayuda-codigo-rec" onChange={(e) => setToken(e.target.value.trim().toLowerCase())} required autoFocus />
              <p id="ayuda-codigo-rec" className="texto-ayuda">Copia los 32 caracteres del correo de recuperación, sin espacios. El código de activación de 64 caracteres no sirve aquí. Vence en una hora desde la solicitud.</p>
            </div>
            <div className="campo">
              <label htmlFor="nueva">Nueva contraseña (mínimo 8)</label>
              <input disabled={enviando} id="nueva" type="password" autoComplete="new-password" minLength={8} value={nueva} onChange={(e) => setNueva(e.target.value)} required />
            </div>
            {error && <p className="mensaje-error" role="alert">{error}</p>}
            <button className="boton" style={{ width: '100%' }} disabled={enviando}>
              {enviando ? 'Guardando…' : 'Restablecer contraseña'}
            </button>
            <button type="button" className="enlace" disabled={enviando} onClick={() => { limpiar(); setToken(''); setNueva(''); setModo('entrar'); }}>
              Volver a iniciar sesión
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
