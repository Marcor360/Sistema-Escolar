import { useRef, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { api, mensajeDeError } from '../api/client';
import { useConfirmacion } from './useConfirmacion';

/** El servidor vuelve a comprobar rol, vínculos e identidad; ocultar el botón no autoriza. */
export function EliminarRegistro({ ruta, nombre, deshabilitado, alEliminar }: {
  ruta: string; nombre: string; deshabilitado?: boolean; alEliminar: () => void | Promise<void>;
}) {
  const auth = useAuth();
  const confirmacion = useConfirmacion();
  const ocupado = useRef(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  if (!auth?.sesion?.roles.includes('SUPERADMIN')) return null;

  const eliminar = async () => {
    if (ocupado.current || deshabilitado) return;
    ocupado.current = true;
    try {
      const aceptar = await confirmacion.solicitar({
        titulo: 'Eliminar definitivamente',
        descripcion: `Vas a eliminar ${nombre}. Esta acción no se puede deshacer. En alumnos y docentes también elimina la cuenta y sus accesos.\nSolo se permite si no existen registros vinculados. Para conservar el expediente, usa la baja o desactivación.`,
        riesgo: 'alto', etiqueta: 'Eliminar definitivamente',
      });
      if (!aceptar) return;
      setEnviando(true); setError('');
      await api.delete(`${ruta}/permanente`, { data: { confirmacion: 'ELIMINAR' } });
      await alEliminar();
    } catch (fallo) { setError(mensajeDeError(fallo)); }
    finally { ocupado.current = false; setEnviando(false); }
  };
  return <>
    {confirmacion.elemento}
    <button type="button" className="boton peligro chico" disabled={enviando || deshabilitado}
      aria-label={`Eliminar definitivamente ${nombre}`} onClick={eliminar}>
      {enviando ? 'Eliminando…' : 'Eliminar definitivamente'}
    </button>
    {error && <span className="mensaje-error" role="alert">{error}</span>}
  </>;
}
