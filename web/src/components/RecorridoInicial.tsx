import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { claveRecorrido } from './recorrido-por-rol';
import type { PasoRecorrido } from './recorrido-por-rol';

interface Props { usuarioId?: number; roles: readonly string[]; pasos: PasoRecorrido[] }
function completado(clave: string): boolean {
  try { return localStorage.getItem(clave) === '1'; } catch { return false; }
}
export function RecorridoInicial({ usuarioId, roles, pasos }: Props) {
  const clave = usuarioId ? claveRecorrido(usuarioId, roles) : '';
  const [actual, setActual] = useState<number | null>(() => clave && pasos.length && !completado(clave) ? 0 : null);
  const navigate = useNavigate();
  const location = useLocation();
  const origen = useRef<string | null>(null);
  const panel = useRef<HTMLElement>(null);

  useEffect(() => { setActual(clave && pasos.length && !completado(clave) ? 0 : null); }, [clave, pasos.length]);
  useEffect(() => {
    const repetir = () => { if (clave && pasos.length) { origen.current = location.pathname; setActual(0); } };
    window.addEventListener('escolar:reiniciar-recorrido', repetir);
    return () => window.removeEventListener('escolar:reiniciar-recorrido', repetir);
  }, [clave, pasos.length, location.pathname]);

  const destino = actual === null ? null : pasos[Math.min(actual, pasos.length - 1)]?.destino;
  useEffect(() => {
    if (destino === null || !destino) return;
    if (origen.current === null) origen.current = location.pathname;
    if (location.pathname !== destino) navigate(destino);
  }, [destino, location.pathname, navigate]);

  useEffect(() => {
    if (actual === null || !destino || location.pathname !== destino) return;
    const enlace = Array.from(document.querySelectorAll<HTMLAnchorElement>('#navegacion-escolar a[href]'))
      .find(elemento => new URL(elemento.href).pathname === destino);
    enlace?.classList.add('recorrido-destacado');
    enlace?.scrollIntoView({ block: 'nearest', behavior: 'auto' });
    panel.current?.focus();
    return () => enlace?.classList.remove('recorrido-destacado');
  }, [actual, destino, location.pathname]);

  const terminar = () => {
    if (clave) { try { localStorage.setItem(clave, '1'); } catch { /* Sin almacenamiento. */ } }
    setActual(null);
    origen.current = null;
  };
  if (!clave || !pasos.length || actual === null) return null;
  const paso = pasos[Math.min(actual, pasos.length - 1)];
  return <aside ref={panel} tabIndex={-1} className="recorrido-panel" aria-labelledby="recorrido-titulo" aria-live="polite">
    <p className="recorrido-progreso">Recorrido guiado · {actual + 1} de {pasos.length}</p>
    <h2 id="recorrido-titulo">{paso.titulo}</h2>
    <p>{paso.descripcion}</p>
    <p className="recorrido-ayuda">Se muestra la sección real y se destaca su acceso en el menú. Puedes finalizar este recorrido en cualquier momento.</p>
    <div className="recorrido-acciones">
      <button type="button" className="boton secundario" onClick={terminar}>Omitir recorrido</button>
      {actual > 0 && <button type="button" className="boton secundario" onClick={() => setActual(actual - 1)}>Anterior</button>}
      <button type="button" className="boton" onClick={actual === pasos.length - 1 ? terminar : () => setActual(actual + 1)}>
        {actual === pasos.length - 1 ? 'Finalizar' : 'Siguiente'}
      </button>
    </div>
  </aside>;
}
