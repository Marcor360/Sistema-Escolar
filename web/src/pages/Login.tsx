import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { api, mensajeDeError } from '../api/client';

type Modo = 'entrar' | 'solicitar' | 'restablecer';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [modo, setModo] = useState<Modo>('entrar');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [token, setToken] = useState('');
  const [nueva, setNueva] = useState('');
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [enviando, setEnviando] = useState(false);

  const limpiar = () => { setError(''); setAviso(''); };

  const entrar = async (e: FormEvent) => {
    e.preventDefault();
    limpiar();
    setEnviando(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(mensajeDeError(err));
    } finally {
      setEnviando(false);
    }
  };

  const solicitar = async (e: FormEvent) => {
    e.preventDefault();
    limpiar();
    setEnviando(true);
    try {
      const { data } = await api.post('/auth/forgot-password', { email });
      setAviso(`${data.mensaje}. Copia el código del correo y captúralo abajo.`);
      setModo('restablecer');
    } catch (err) {
      setError(mensajeDeError(err));
    } finally {
      setEnviando(false);
    }
  };

  const restablecer = async (e: FormEvent) => {
    e.preventDefault();
    limpiar();
    setEnviando(true);
    try {
      await api.post('/auth/reset-password', { token: token.trim(), password: nueva });
      setAviso('Contraseña restablecida. Ya puedes iniciar sesión.');
      setModo('entrar');
      setPassword('');
    } catch (err) {
      setError(mensajeDeError(err));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="login-fondo">
      <div className="login-caja">
        <div className="monograma" aria-hidden>SE</div>
        <h1>Sistema Escolar</h1>

        {modo === 'entrar' && (
          <form onSubmit={entrar}>
            <div className="campo">
              <label htmlFor="email">Correo institucional</label>
              <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
            </div>
            <div className="campo">
              <label htmlFor="password">Contraseña</label>
              <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            {error && <p className="mensaje-error">{error}</p>}
            {aviso && <p className="mensaje-ok">{aviso}</p>}
            <button className="boton" style={{ width: '100%' }} disabled={enviando}>
              {enviando ? 'Verificando…' : 'Entrar'}
            </button>
            <button type="button" className="enlace" onClick={() => { limpiar(); setModo('solicitar'); }}>
              ¿Olvidaste tu contraseña?
            </button>
          </form>
        )}

        {modo === 'solicitar' && (
          <form onSubmit={solicitar}>
            <p className="detalle" style={{ marginTop: 0 }}>
              Te enviaremos un código de recuperación al correo registrado (vence en 1 hora).
            </p>
            <div className="campo">
              <label htmlFor="email-rec">Correo institucional</label>
              <input id="email-rec" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
            </div>
            {error && <p className="mensaje-error">{error}</p>}
            <button className="boton" style={{ width: '100%' }} disabled={enviando}>
              {enviando ? 'Enviando…' : 'Enviar código'}
            </button>
            <button type="button" className="enlace" onClick={() => { limpiar(); setModo('entrar'); }}>
              Volver a iniciar sesión
            </button>
          </form>
        )}

        {modo === 'restablecer' && (
          <form onSubmit={restablecer}>
            {aviso && <p className="mensaje-ok" style={{ marginTop: 0 }}>{aviso}</p>}
            <div className="campo">
              <label htmlFor="token">Código de recuperación</label>
              <input id="token" value={token} onChange={(e) => setToken(e.target.value)} required autoFocus />
            </div>
            <div className="campo">
              <label htmlFor="nueva">Nueva contraseña (mínimo 8)</label>
              <input id="nueva" type="password" minLength={8} value={nueva} onChange={(e) => setNueva(e.target.value)} required />
            </div>
            {error && <p className="mensaje-error">{error}</p>}
            <button className="boton" style={{ width: '100%' }} disabled={enviando}>
              {enviando ? 'Guardando…' : 'Restablecer contraseña'}
            </button>
            <button type="button" className="enlace" onClick={() => { limpiar(); setModo('entrar'); }}>
              Volver a iniciar sesión
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
