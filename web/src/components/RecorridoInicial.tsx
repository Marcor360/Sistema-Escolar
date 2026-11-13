import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { claveRecorrido } from './recorrido-por-rol';
import type { AreaRecorrido, PasoRecorrido } from './recorrido-por-rol';

interface Props {
  usuarioId?: number;
  roles: readonly string[];
  pasos: PasoRecorrido[];
  areas?: AreaRecorrido[];
}
function completado(clave: string): boolean {
  try {
    return localStorage.getItem(clave) === '1';
  } catch {
    return false;
  }
}
export function RecorridoInicial({ usuarioId, roles, pasos, areas }: Props) {
  const alumno = roles.includes('ALUMNO');
  const [reducido, setReducido] = useState(false);
  const clave = usuarioId ? claveRecorrido(usuarioId, roles) : '';
  const [actual, setActual] = useState<number | null>(() => (clave && pasos.length && !alumno && !completado(clave) ? 0 : null));
  const [areaId, setAreaId] = useState(areas?.[0]?.id ?? 'general');
  const [elegir, setElegir] = useState(!!areas?.length);
  const area = areas?.find((a) => a.id === areaId) ?? areas?.[0];
  const guia = area?.pasos ?? pasos;
  const navigate = useNavigate();
  const navegar = useRef(navigate);
  useEffect(() => {
    navegar.current = navigate;
  }, [navigate]);
  const location = useLocation();
  const panel = useRef<HTMLElement>(null);

  useEffect(() => {
    let vigente = true;
    setActual(null);
    setReducido(false);
    setElegir(!!areas?.length);
    if (clave && pasos.length && !completado(clave)) {
      if (alumno) {
        void api.get<{ accesoPrevio: boolean }>('/auth/me').then(({ data }) => {
          if (vigente && data.accesoPrevio === false) setActual(0);
        }).catch(() => { /* La guía sigue disponible desde el menú. */ });
      } else setActual(0);
    }
    return () => { vigente = false; };
  }, [clave, pasos.length, alumno, areas?.length]);
  useEffect(() => {
    const repetir = () => {
      if (clave && pasos.length) {
        setActual(0);
        setReducido(false);
        setElegir(!!areas?.length);
      }
    };
    window.addEventListener('escolar:reiniciar-recorrido', repetir);
    return () => window.removeEventListener('escolar:reiniciar-recorrido', repetir);
  }, [clave, pasos.length, location.pathname, areas?.length]);

  const destino = actual === null || elegir ? null : guia[Math.min(actual, guia.length - 1)]?.destino;
  useEffect(() => {
    if (destino === null || !destino) return;
    navegar.current(destino);
  }, [destino]);

  useEffect(() => {
    if (actual === null || !destino || location.pathname !== destino?.split('?')[0]) return;
    const enlace = Array.from(document.querySelectorAll<HTMLAnchorElement>('#navegacion-escolar a[href]')).find(
      (elemento) => new URL(elemento.href).pathname === destino.split('?')[0],
    );
    enlace?.classList.add('recorrido-destacado');
    enlace?.scrollIntoView({ block: 'nearest', behavior: 'auto' });
    panel.current?.focus();
    return () => enlace?.classList.remove('recorrido-destacado');
  }, [actual, destino, location.pathname]);

  useEffect(() => {
    if (actual !== null && elegir) panel.current?.focus();
  }, [actual, elegir]);
  const terminar = () => {
    if (clave) {
      try {
        localStorage.setItem(clave, '1');
      } catch {
        /* Sin almacenamiento. */
      }
    }
    setActual(null);
  };
  if (!clave || !pasos.length || actual === null) return null;
  const paso = guia[Math.min(actual, guia.length - 1)];
  if (reducido) return <aside className="recorrido-reducido" aria-label="Guía pausada">
    <span>{area?.titulo ?? 'Recorrido'} · Paso {Math.min(actual + 1, guia.length)} de {guia.length}</span>
    <button className="boton secundario" onClick={() => setReducido(false)}>Continuar guía</button>
    <button className="boton secundario" onClick={terminar}>Cerrar guía</button>
  </aside>;
  if (elegir && areas?.length)
    return (
      <aside
        ref={panel}
        tabIndex={-1}
        onKeyDown={(e) => {
          if (e.key === 'Escape') terminar();
        }}
        className="recorrido-panel"
        aria-labelledby="recorrido-titulo"
      >
        <p className="recorrido-progreso">Guías especializadas por área</p>
        <h2 id="recorrido-titulo">¿Qué herramientas quieres conocer?</h2>
        <p>Elige una tarea. Cada guía muestra el orden recomendado y lo que debes revisar antes de guardar. Puedes omitirla y volver desde Mi cuenta.</p>
        <div className="recorrido-areas">
          {areas.map((a) => (
            <button
              key={a.id}
              type="button"
              className="boton secundario"
              onClick={() => {
                setAreaId(a.id);
                setActual(0);
                setElegir(false);
              }}
            >
              <strong>{a.titulo}</strong>
              <span>{a.resumen}</span>
              <small>{a.pasos.length} pasos</small>
            </button>
          ))}
        </div>
        <button className="boton secundario" onClick={terminar}>
          Omitir recorrido
        </button>
      </aside>
    );
  return (
    <aside
      ref={panel}
      tabIndex={-1}
      onKeyDown={(e) => {
        if (e.key === 'Escape') terminar();
      }}
      className="recorrido-panel"
      aria-labelledby="recorrido-titulo"
      aria-live="polite"
    >
      <p className="recorrido-progreso">
        Recorrido guiado · {actual + 1} de {guia.length}
        {area ? ' · ' + area.titulo : ''}
      </p>
      <label className="recorrido-elegir-paso">Ir a un paso
        <select value={Math.min(actual, guia.length - 1)} onChange={e => setActual(Number(e.target.value))}>
          {guia.map((p, i) => <option key={i} value={i}>{i + 1}. {p.titulo.replace(/^\d+\.\s*/, '')}</option>)}
        </select>
      </label>
      <h2 id="recorrido-titulo">{paso.titulo}</h2>
      <p>{paso.descripcion}</p>
      {paso.comprobar && (
        <p className="recorrido-comprobar">
          <strong>Antes de continuar:</strong> {paso.comprobar}
        </p>
      )}
      <p className="recorrido-ayuda">
        Esta guía no guarda datos ni confirma operaciones. Reduce la guía para trabajar y retómala cuando quieras.
      </p>
      <div className="recorrido-acciones">
        <button type="button" className="boton secundario" onClick={() => setReducido(true)}>Reducir guía</button>
        <button type="button" className="boton secundario" onClick={() => navigate(paso.destino)}>Abrir pantalla del paso</button>
        <button type="button" className="boton secundario" onClick={terminar}>
          Omitir recorrido
        </button>
        {areas?.length && (
          <button type="button" className="boton secundario" onClick={() => setElegir(true)}>
            Cambiar de área
          </button>
        )}
        {actual > 0 && (
          <button type="button" className="boton secundario" onClick={() => setActual(actual - 1)}>
            Anterior
          </button>
        )}
        <button
          type="button"
          className="boton"
          onClick={actual === guia.length - 1 ? terminar : () => setActual(actual + 1)}
        >
          {actual === guia.length - 1 ? 'Finalizar' : 'Siguiente'}
        </button>
      </div>
    </aside>
  );
}
