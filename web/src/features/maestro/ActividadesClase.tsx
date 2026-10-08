import type { useConfirmacion } from '../../components/useConfirmacion';
import { FormEvent } from 'react';
import { api, mensajeDeError } from '../../api/client';
import { fechaHora } from '../../utils/formato';
import type { GrupoMateria, Actividad } from './tipos';
import type * as React from 'react';
interface Props {
claseActiva: GrupoMateria;
crearActividad: (e: FormEvent) => Promise<void>;
form: { titulo: string; descripcion: string; tipo: string; parcial: string; ponderacion: string; fechaEntrega: string; };
setForm: React.Dispatch<React.SetStateAction<{ titulo: string; descripcion: string; tipo: string; parcial: string; ponderacion: string; fechaEntrega: string; }>>;
enviando: boolean;
editandoActividad: number | null;
actividades: Actividad[];
verEntregas: (actividad: Actividad) => Promise<void>;
setEditandoActividad: React.Dispatch<React.SetStateAction<number | null>>;
confirmacion: ReturnType<typeof useConfirmacion>;
setEnviando: React.Dispatch<React.SetStateAction<boolean>>;
abrirClase: (clase: GrupoMateria) => Promise<void>;
setError: React.Dispatch<React.SetStateAction<string>>;
}
export function ActividadesClase({ claseActiva, crearActividad, form, setForm, enviando, editandoActividad, actividades, verEntregas, setEditandoActividad, confirmacion, setEnviando, abrirClase, setError }: Props) { return (<section className="panel">
          <h2>Actividades — {claseActiva.grupo.nombre} · {claseActiva.materia.nombre}</h2>
          <form onSubmit={crearActividad} className="fila" style={{ marginBottom: 14 }}>
            <div className="campo"><label htmlFor="maestro-campo-1">Título</label>
              <input id="maestro-campo-1" required value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} />
            </div>
            <div className="campo"><label htmlFor="descripcion-actividad">Descripción</label><textarea id="descripcion-actividad" maxLength={4000} value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} /></div><div className="campo"><label htmlFor="maestro-campo-2">Tipo</label>
              <select id="maestro-campo-2" value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>
                <option>TAREA</option><option>EXAMEN</option><option>PROYECTO</option><option>PARTICIPACION</option>
              </select>
            </div>
            <div className="campo"><label htmlFor="maestro-campo-3">Parcial</label>
              <select id="maestro-campo-3" value={form.parcial} onChange={(e) => setForm({ ...form, parcial: e.target.value })}>
                <option value="1">1</option><option value="2">2</option><option value="3">3</option>
              </select>
            </div>
            <div className="campo"><label htmlFor="maestro-campo-4">Peso de seguimiento (sin efecto en la nota oficial)</label>
              <input id="maestro-campo-4" type="number" min={0} max={100} value={form.ponderacion} onChange={(e) => setForm({ ...form, ponderacion: e.target.value })} />
            </div>
            <div className="campo"><label htmlFor="maestro-campo-5">Fecha de entrega</label>
              <input id="maestro-campo-5" type="datetime-local" value={form.fechaEntrega} onChange={(e) => setForm({ ...form, fechaEntrega: e.target.value })} />
            </div>
            <button disabled={enviando} className="boton">{editandoActividad ? 'Guardar corrección' : 'Crear actividad'}</button>
          </form>

          <table className="tabla">
            <thead><tr><th>Actividad</th><th>Tipo</th><th>Parcial</th><th>Entrega</th><th /></tr></thead>
            <tbody>
              {actividades.map((a) => (
                <tr key={a.id}>
                  <td>{a.titulo}</td><td>{a.tipo}</td><td>{a.parcial}</td>
                  <td>{a.fechaEntrega ? fechaHora(a.fechaEntrega) : 'Sin fecha'}</td>
                  <td className="derecha">
                    <button disabled={enviando} className="boton secundario chico" onClick={() => verEntregas(a)}>Entregas</button>
                    <button disabled={enviando} onClick={() => { setEditandoActividad(a.id); setForm({ titulo: a.titulo, descripcion: a.descripcion ?? '', tipo: a.tipo, parcial: String(a.parcial), ponderacion: String(a.ponderacion), fechaEntrega: a.fechaEntrega ? new Date(new Date(a.fechaEntrega).getTime() - new Date(a.fechaEntrega).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '' }); }}>Editar actividad</button>
                    <button disabled={enviando} onClick={async () => { if (!claseActiva || !await confirmacion.solicitar('¿Desactivar esta actividad? Se conserva el historial.')) return; setEnviando(true); try { await api.delete(`/actividades/${a.id}`); await abrirClase(claseActiva); } catch (err) { setError(mensajeDeError(err)); } finally { setEnviando(false); } }}>Desactivar</button>
                  </td>
                </tr>
              ))}
              {actividades.length === 0 && (
                <tr><td className="vacio" colSpan={5}>Sin actividades. Crea la primera arriba.</td></tr>
              )}
            </tbody>
          </table>
        </section>); }
