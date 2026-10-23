import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { claveRecorrido } from './recorrido-por-rol';
import type { PasoRecorrido } from './recorrido-por-rol';

interface Props { usuarioId?: number; roles: readonly string[]; pasos: PasoRecorrido[] }
function completado(clave: string): boolean {
  try { return localStorage.getItem(clave) === '1'; } catch { return false; }
}
export function RecorridoInicial({ usuarioId, roles, pasos }: Props) {
  const clave = usuarioId ? claveRecorrido(usuarioId, roles) : '';
  const [actual, setActual] = useState<number | null>(() => clave && pasos.length && !completado(clave) ? 0 : null);
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { setActual(clave && pasos.length && !completado(clave) ? 0 : null); }, [clave, pasos.length]);
  useEffect(() => {
    const repetir = () => { if (clave && pasos.length) setActual(0); };
    window.addEventListener('escolar:reiniciar-recorrido', repetir);
    return () => window.removeEventListener('escolar:reiniciar-recorrido', repetir);
  }, [clave, pasos.length]);
  useEffect(() => { if (actual !== null && ref.current && !ref.current.open) ref.current.showModal?.(); }, [actual]);
  const terminar = () => {
    if (clave) { try { localStorage.setItem(clave, '1'); } catch { /* Sin almacenamiento. */ } }
    ref.current?.close?.();
    setActual(null);
  };
  if (!clave || !pasos.length || actual === null) return null;
  const paso = pasos[Math.min(actual, pasos.length - 1)];
  return <dialog ref={ref} className="recorrido-dialogo" aria-labelledby="recorrido-titulo"
    onCancel={e => { e.preventDefault(); terminar(); }}>
    <p className="recorrido-progreso">Bienvenido · paso {actual + 1} de {pasos.length}</p>
    <h2 id="recorrido-titulo">{paso.titulo}</h2>
    <p>{paso.descripcion}</p>
    <p className="recorrido-ayuda">Solo verás secciones autorizadas. Puedes omitir el recorrido o volver a abrirlo desde el menú.</p>
    <div className="recorrido-acciones">
      <button type="button" className="boton secundario" onClick={terminar}>Omitir recorrido</button>
      <Link to={paso.destino} className="boton secundario" onClick={terminar}>Ir a la sección</Link>
      {actual > 0 && <button type="button" className="boton secundario" onClick={() => setActual(actual - 1)}>Anterior</button>}
      <button type="button" className="boton" onClick={actual === pasos.length - 1 ? terminar : () => setActual(actual + 1)}>
        {actual === pasos.length - 1 ? 'Finalizar' : 'Siguiente'}
      </button>
    </div>
  </dialog>;
}
