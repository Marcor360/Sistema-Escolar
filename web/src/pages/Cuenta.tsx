import { FormEvent, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, mensajeDeError } from '../api/client';
import { Encabezado } from '../components/Encabezado';
import { useAuth } from '../auth/AuthContext';

export default function CuentaPage() {
  const { sesion, finalizarSesionLocal } = useAuth();
  const navigate = useNavigate();
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const envioEnCurso = useRef(false);

  const cambiar = async (e: FormEvent) => {
    e.preventDefault();
    if (envioEnCurso.current) return;
    setError('');
    if (nueva !== confirmar) {
      setError('La confirmación no coincide con la nueva contraseña.');
      return;
    }
    envioEnCurso.current = true;
    setEnviando(true);
    try {
      await api.post('/auth/cambiar-password', { actual, nueva });
      navigate('/login', {
        replace: true,
        state: { aviso: 'Contraseña actualizada. Por seguridad, vuelve a iniciar sesión.' },
      });
      finalizarSesionLocal();
    } catch (err) {
      setError(mensajeDeError(err));
    } finally {
      envioEnCurso.current = false;
      setEnviando(false);
    }
  };

  return (
    <>
      <Encabezado titulo="Mi cuenta" detalle={`${sesion?.nombre} · ${sesion?.email}`} />

      <section className="panel" style={{ maxWidth: 420 }}>
        <h2>Cambiar contraseña</h2>
        <p>Por seguridad, al actualizarla deberás iniciar sesión nuevamente.</p>
        <form onSubmit={cambiar} aria-busy={enviando}>
          <fieldset disabled={enviando} style={{ border: 0, margin: 0, padding: 0, minWidth: 0 }}>
            <div className="campo" style={{ marginBottom: 10 }}>
              <label htmlFor="cuenta-password-actual">Contraseña actual</label>
              <input id="cuenta-password-actual" type="password" required autoComplete="current-password" value={actual} onChange={(e) => setActual(e.target.value)} />
            </div>
            <div className="campo" style={{ marginBottom: 10 }}>
              <label htmlFor="cuenta-password-nueva">Nueva contraseña (mínimo 8 caracteres)</label>
              <input id="cuenta-password-nueva" type="password" required minLength={8} autoComplete="new-password" value={nueva} onChange={(e) => setNueva(e.target.value)} />
            </div>
            <div className="campo" style={{ marginBottom: 14 }}>
              <label htmlFor="cuenta-password-confirmar">Confirmar nueva contraseña</label>
              <input id="cuenta-password-confirmar" type="password" required autoComplete="new-password" value={confirmar} onChange={(e) => setConfirmar(e.target.value)} />
            </div>
            {error && <p className="mensaje-error" role="alert">{error}</p>}
            <button className="boton" disabled={enviando}>{enviando ? 'Actualizando…' : 'Actualizar contraseña'}</button>
          </fieldset>
        </form>
      </section>
    </>
  );
}
