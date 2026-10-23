import { FormEvent, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, mensajeDeError } from '../api/client';
import { Encabezado } from '../components/Encabezado';
import { useAuth } from '../auth/AuthContext';

interface PerfilActual {
  id: number;
  nombreCompleto: string;
  email: string;
  telefono: string | null;
  activo: boolean;
  roles: { clave: string; nombre: string }[];
  passwordChangeRequired: boolean;
}
export default function CuentaPage() {
  const { sesion, finalizarSesionLocal } = useAuth();
  const navigate = useNavigate();
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const envioEnCurso = useRef(false);
  const [perfil, setPerfil] = useState<PerfilActual | null>(null);
  const [cargandoPerfil, setCargandoPerfil] = useState(true);
  const [errorPerfil, setErrorPerfil] = useState('');
  const [intento, setIntento] = useState(0);
  useEffect(() => {
    let vigente = true;
    setCargandoPerfil(true);
    setErrorPerfil('');
    api.get<PerfilActual>('/auth/me')
      .then(({ data }) => { if (vigente) setPerfil(data); })
      .catch(() => { if (vigente) setErrorPerfil('No se pudo consultar tu perfil. Inténtalo nuevamente.'); })
      .finally(() => { if (vigente) setCargandoPerfil(false); });
    return () => { vigente = false; };
  }, [intento, sesion?.sub]);


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

      <div className="cuenta-rejilla">
        <section className="panel cuenta-perfil" aria-labelledby="titulo-perfil">
          <h2 id="titulo-perfil">Datos de mi perfil</h2>
          <p className="texto-ayuda">Información de tu cuenta institucional, de solo lectura.</p>
          {cargandoPerfil && <p role="status">Consultando información de la cuenta…</p>}
          {errorPerfil && <p role="alert" className="mensaje-error">{errorPerfil}</p>}
          {perfil && !cargandoPerfil && <dl className="cuenta-datos">
            <div><dt>Identificador</dt><dd>{perfil.id}</dd></div>
            <div><dt>Nombre completo</dt><dd>{perfil.nombreCompleto}</dd></div>
            <div><dt>Correo institucional</dt><dd>{perfil.email}</dd></div>
            <div><dt>Teléfono</dt><dd>{perfil.telefono || 'No registrado'}</dd></div>
            <div><dt>Roles asignados</dt><dd>{perfil.roles.map((r) => r.nombre || r.clave).join(' · ') || 'Sin rol registrado'}</dd></div>
            <div><dt>Estado de cuenta</dt><dd>{perfil.activo ? 'Activa' : 'Inactiva'}</dd></div>
            <div><dt>Seguridad</dt><dd>{perfil.passwordChangeRequired ? 'Requiere cambio de contraseña' : 'Contraseña configurada'}</dd></div>
          </dl>}
          <div className="cuenta-acciones">
            <button type="button" className="boton secundario" onClick={() => setIntento(i => i + 1)} disabled={cargandoPerfil}>Actualizar información</button>
            <button type="button" className="boton secundario" onClick={() => window.dispatchEvent(new Event('escolar:reiniciar-recorrido'))}>Ver recorrido</button>
          </div>
        </section>
        <section className="panel cuenta-seguridad">
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
      </div>
    </>
  );
}
