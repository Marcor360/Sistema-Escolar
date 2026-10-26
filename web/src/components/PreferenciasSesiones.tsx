import { useState } from 'react';
import { api, mensajeDeError } from '../api/client';
import { useDatos } from '../hooks/useDatos';
import { useConfirmacion } from './useConfirmacion';
interface Preferencia {
  tipo: string;
  push: boolean;
  correo: boolean;
}
interface Sesion {
  id: string;
  portal: string;
  actual: boolean;
  ultimaActividadEn: string;
  expiraEn: string;
}
export function PreferenciasSesiones() {
  const {
    datos: preferencias,
    setDatos: setPreferencias,
    error: errorPreferencias,
  } = useDatos<Preferencia[]>(() => api.get('/seguimiento/preferencias').then((r) => r.data), []);
  const {
    datos: sesiones,
    error: errorSesiones,
    recargar,
  } = useDatos<Sesion[]>(() => api.get('/seguimiento/sesiones').then((r) => r.data), []);
  const [error, setError] = useState(''),
    [mensaje, setMensaje] = useState(''),
    [ocupado, setOcupado] = useState(false);
  const confirmar = useConfirmacion();
  const guardar = async () => {
    setOcupado(true);
    setError('');
    try {
      await api.patch('/seguimiento/preferencias', { preferencias });
      setMensaje('Preferencias guardadas');
    } catch (e) {
      setError(mensajeDeError(e));
    } finally {
      setOcupado(false);
    }
  };
  const revocar = async (s: Sesion) => {
    if (!(await confirmar.solicitar('¿Cerrar esta sesión de ' + s.portal + '?'))) return;
    setOcupado(true);
    setError('');
    try {
      await api.delete('/seguimiento/sesiones/' + s.id);
      recargar();
    } catch (e) {
      setError(mensajeDeError(e));
    } finally {
      setOcupado(false);
    }
  };
  return (
    <section className="panel">
      {confirmar.elemento}
      <h2>Avisos y sesiones</h2>
      {(error || errorPreferencias || errorSesiones) && (
        <p role="alert">{error || errorPreferencias || errorSesiones}</p>
      )}
      {mensaje && <p role="status">{mensaje}</p>}
      <p>
        Los avisos permanecen en tu bandeja. Los correos de seguridad siempre están habilitados; los opcionales dependen
        del proveedor configurado.
      </p>
      {preferencias.map((p) => (
        <fieldset key={p.tipo}>
          <legend>{p.tipo}</legend>
          {(['push', 'correo'] as const).map((c) => (
            <label key={c}>
              <input
                type="checkbox"
                checked={p[c]}
                disabled={ocupado}
                onChange={(e) =>
                  setPreferencias((f) => f.map((x) => (x.tipo === p.tipo ? { ...x, [c]: e.target.checked } : x)))
                }
              />
              {c === 'push' ? 'Notificaciones del dispositivo' : 'Correo opcional'}
            </label>
          ))}
        </fieldset>
      ))}
      <button disabled={ocupado || !preferencias.length} onClick={guardar}>
        Guardar preferencias
      </button>
      <h3>Sesiones abiertas</h3>
      <p>Se muestran el portal y la última actividad registrada; no se identifica el modelo del dispositivo.</p>
      {sesiones.map((s) => (
        <p key={s.id}>
          {s.portal} · {s.ultimaActividadEn ? new Date(s.ultimaActividadEn).toLocaleString('es-MX') : 'Sin actividad'}{' '}
          {s.actual ? (
            ' · Esta sesión'
          ) : (
            <button disabled={ocupado} onClick={() => void revocar(s)}>
              Cerrar sesión remota
            </button>
          )}
        </p>
      ))}
      <button onClick={recargar} disabled={ocupado}>
        Actualizar sesiones
      </button>
    </section>
  );
}
