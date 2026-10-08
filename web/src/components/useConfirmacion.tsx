import { useEffect, useId, useRef, useState } from 'react';
interface Opciones { titulo?: string; descripcion: string; riesgo?: 'normal' | 'alto'; etiqueta?: string }
/** Confirmación modal asíncrona; Escape cancela y devuelve foco, sin diálogos del navegador. */
export function useConfirmacion() {
  const [opciones,setOpciones] = useState<Opciones | null>(null), [enviando,setEnviando] = useState(false);
  const dialogo = useRef<HTMLDialogElement>(null), cancelar = useRef<HTMLButtonElement>(null), origen = useRef<HTMLElement | null>(null);
  const pendiente = useRef<((aceptado: boolean) => void) | null>(null), tituloId = useId(), descripcionId = useId();
  const solicitar = (datos: string | Opciones): Promise<boolean> => {
    if (pendiente.current) return Promise.resolve(false);
    origen.current = document.activeElement as HTMLElement; setEnviando(false);
    setOpciones(typeof datos === 'string' ? { descripcion: datos, riesgo: 'alto' } : datos);
    return new Promise((resolver) => { pendiente.current = resolver; });
  };
  const finalizar = (aceptado: boolean) => {
    if (!pendiente.current) return; setEnviando(true);
    const resolver = pendiente.current; pendiente.current = null;
    dialogo.current?.close(); setOpciones(null); resolver(aceptado); origen.current?.focus();
  };
  useEffect(() => { if (opciones && dialogo.current && !dialogo.current.open) { dialogo.current.showModal(); cancelar.current?.focus(); } },[opciones]);
  useEffect(() => () => { pendiente.current?.(false); pendiente.current = null; },[]);
  const elemento = opciones && <dialog ref={dialogo} aria-labelledby={tituloId} aria-describedby={descripcionId} onCancel={(e) => { e.preventDefault(); finalizar(false); }}>
    <form onSubmit={(e) => { e.preventDefault(); finalizar(true); }} aria-busy={enviando}>
      <h2 id={tituloId}>{opciones.titulo ?? 'Confirmar operación'}</h2><p id={descripcionId} style={{ whiteSpace: 'pre-line' }}>{opciones.descripcion}</p>
      {opciones.riesgo === 'alto' && <p>Revisa los datos antes de confirmar.</p>}
      <p role="status">{enviando ? 'Confirmando…' : ''}</p>
      <button type="button" ref={cancelar} disabled={enviando} onClick={() => finalizar(false)}>Cancelar</button>
      <button className="boton" disabled={enviando}>{opciones.etiqueta ?? 'Confirmar'}</button>
    </form>
  </dialog>;
  return { solicitar, elemento };
}
