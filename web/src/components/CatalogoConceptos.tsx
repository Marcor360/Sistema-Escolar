import { FormEvent, useCallback, useEffect, useState } from 'react';
import { api, mensajeDeError } from '../api/client';
interface Concepto { id: number; clave: string; nombre: string; tipo: string; montoBase: number; activo: boolean; aplicaRecargo: boolean }
const inicial = { clave: '', nombre: '', tipo: 'OTRO', montoBase: '0', aplicaRecargo: false, activo: true };
export function CatalogoConceptos({ cambiado }: { cambiado: () => void }) {
  const [datos, setDatos] = useState<Concepto[]>([]); const [form, setForm] = useState(inicial); const [id, setId] = useState<number | null>(null);
  const [enviando, setEnviando] = useState(false); const [error, setError] = useState(''); const [mensaje, setMensaje] = useState('');
  const cargar = useCallback(async () => { const { data } = await api.get<Concepto[]>('/finanzas/conceptos', { params: { incluirInactivos: true } }); setDatos(data); }, []);
  useEffect(() => { void cargar().catch((err) => setError(mensajeDeError(err))); }, [cargar]);
  const guardar = async (e: FormEvent) => { e.preventDefault(); if (enviando) return; setEnviando(true); setError(''); setMensaje('');
    try { const datos = { ...form, montoBase: Number(form.montoBase) }; if (id) await api.patch(`/finanzas/conceptos/${id}`, datos); else { const { activo: _activo, ...alta } = datos; void _activo; await api.post('/finanzas/conceptos', alta); }
      setForm(inicial); setId(null); await cargar(); cambiado(); setMensaje('Concepto guardado');
    } catch (err) { setError(mensajeDeError(err)); } finally { setEnviando(false); }
  };
  return <section className="panel"><h2>Catálogo de conceptos</h2><p>La beca o descuento reduce el cargo. Los recargos se calculan sobre el cargo vencido y solo si el concepto tiene «Aplica recargo» habilitado.</p>
    {error && <p role="alert" className="mensaje-error">{error}</p>}{mensaje && <p role="status">{mensaje}</p>}
    <form onSubmit={guardar} className="fila"><label htmlFor="concepto-clave">Clave<input id="concepto-clave" required maxLength={20} value={form.clave} onChange={(e) => setForm({ ...form, clave: e.target.value })} /></label><label htmlFor="concepto-nombre">Nombre<input id="concepto-nombre" required maxLength={120} value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} /></label><label htmlFor="concepto-tipo">Tipo<select id="concepto-tipo" value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>{['INSCRIPCION', 'COLEGIATURA', 'OTRO'].map((t) => <option key={t}>{t}</option>)}</select></label><label htmlFor="concepto-monto">Monto base<input id="concepto-monto" required type="number" min={0} step="0.01" value={form.montoBase} onChange={(e) => setForm({ ...form, montoBase: e.target.value })} /></label><label><input type="checkbox" checked={form.aplicaRecargo} onChange={(e) => setForm({ ...form, aplicaRecargo: e.target.checked })} />Aplica recargo</label><label><input type="checkbox" checked={form.activo} onChange={(e) => setForm({ ...form, activo: e.target.checked })} />Disponible para cargos nuevos</label><button className="boton" disabled={enviando}>{id ? 'Guardar corrección' : 'Crear concepto'}</button>{id && <button type="button" onClick={() => { setId(null); setForm(inicial); }}>Cancelar</button>}</form>
    <table className="tabla"><thead><tr><th>Clave</th><th>Nombre</th><th>Tipo</th><th>Recargos</th><th>Estado</th><th>Acción</th></tr></thead><tbody>{datos.map((c) => <tr key={c.id}><td>{c.clave}</td><td>{c.nombre}</td><td>{c.tipo}</td><td>{c.aplicaRecargo ? 'Habilitados' : 'Desactivados'}</td><td>{c.activo ? 'Activo' : 'Inactivo'}</td><td><button disabled={enviando} onClick={() => { setId(c.id); setForm({ clave: c.clave, nombre: c.nombre, tipo: c.tipo, montoBase: String(c.montoBase), activo: c.activo, aplicaRecargo: c.aplicaRecargo }); }}>Editar concepto</button></td></tr>)}</tbody></table>
  </section>;
}
