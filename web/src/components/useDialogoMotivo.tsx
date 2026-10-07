import { FormEvent, useEffect, useRef, useState } from 'react';
import { mensajeDeError } from '../api/client';
interface Accion { titulo: string; advertencia?: string; inicial?: string; minimo?: number; maximo?: number; ejecutar: (valor: string) => Promise<void> }
export function useDialogoMotivo() {
  const [accion, setAccion] = useState<Accion | null>(null), [valor, setValor] = useState(''), [error, setError] = useState(''), [enviando, setEnviando] = useState(false);
  const dialogo = useRef<HTMLDialogElement>(null), campo = useRef<HTMLInputElement>(null), origen = useRef<HTMLElement | null>(null);
  const abrir = (a: Accion) => { origen.current = document.activeElement as HTMLElement; setValor(a.inicial ?? ''); setError(''); setAccion(a); };
  const cerrar = () => { dialogo.current?.close(); setAccion(null); origen.current?.focus(); };
  useEffect(() => { if (accion && dialogo.current && !dialogo.current.open) { dialogo.current.showModal(); campo.current?.focus(); } }, [accion]);
  const enviar = async (e: FormEvent) => { e.preventDefault(); if (!accion || enviando) return; setEnviando(true); setError(''); try { await accion.ejecutar(valor.trim()); cerrar(); } catch (err) { setError(mensajeDeError(err)); } finally { setEnviando(false); } };
  const elemento = accion && <dialog ref={dialogo} aria-labelledby="titulo-dialogo-motivo" onCancel={(e) => { e.preventDefault(); if (!enviando) cerrar(); }}>
    <form onSubmit={enviar}><h2 id="titulo-dialogo-motivo">{accion.titulo}</h2>{accion.advertencia && <p>{accion.advertencia}</p>}
      <label htmlFor="valor-dialogo-motivo">{accion.minimo === 1 ? 'Texto' : 'Motivo'}</label><input ref={campo} id="valor-dialogo-motivo" required minLength={accion.minimo ?? 3} maxLength={accion.maximo ?? 500} disabled={enviando} value={valor} onChange={(e) => setValor(e.target.value)} />
      {error && <p role="alert">{error}</p>}<p role="status">{enviando ? 'Guardando…' : ''}</p><button disabled={enviando}>Confirmar</button><button type="button" disabled={enviando} onClick={cerrar}>Cancelar</button>
    </form></dialog>;
  return { abrir, elemento };
}
