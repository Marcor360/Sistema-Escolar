import { useConfirmacion } from '../components/useConfirmacion';
import { FormEvent, useRef, useState } from 'react';
import { api, mensajeDeError } from '../api/client';
import { Encabezado } from '../components/Encabezado';
import { useDatos } from '../hooks/useDatos';
import { diaLocal, fechaHora, intervaloDias } from '../utils/formato';
import { useAuth } from '../auth/AuthContext';

interface Evento {
  id: number;
  titulo: string;
  descripcion: string | null;
  tipo: 'GENERAL' | 'EXAMEN' | 'ENTREGA' | 'FESTIVO' | 'PAGO' | 'JUNTA';
  fechaInicio: string;
  fechaFin: string | null;
  plantel: { id: number; nombre: string } | null;
}
interface Plantel { id: number; nombre: string }
interface GrupoMateria { grupo: { id: number; nombre: string } }

const FORM_INICIAL = { titulo: '', tipo: 'GENERAL', fechaInicio: '', fechaFin: '', descripcion: '', plantelId: '', grupoId: '' };
const TONO: Record<Evento['tipo'], string> = { GENERAL: 'neutro', EXAMEN: 'mal', ENTREGA: 'aviso', FESTIVO: 'ok', PAGO: 'aviso', JUNTA: 'neutro' };

export default function CalendarioPage() {
  const confirmacion = useConfirmacion();
  const { sesion } = useAuth();
  const esSuperadmin = sesion?.roles.includes('SUPERADMIN') ?? false;
  const maestroPuro = sesion?.roles.includes('MAESTRO') && !sesion.roles.includes('ADMINISTRATIVO') && !esSuperadmin;
  const [desde, setDesde] = useState(diaLocal());
  const [hasta, setHasta] = useState(diaLocal(new Date(Date.now() + 90 * 86400000)));
  const consulta = useRef<{ desde: string; hasta: string; plantelId?: string } | null>(null);
  if (!consulta.current) consulta.current = intervaloDias(desde, hasta);
  const { datos: eventos, cargando, error: errorCarga, recargar } = useDatos<Evento[]>(
    () => api.get('/calendario', { params: consulta.current }).then((r) => r.data), [],
  );
  const { datos: planteles } = useDatos<Plantel[]>(() => api.get('/planteles/mios').then((r) => r.data), []);
  const { datos: clases } = useDatos<GrupoMateria[]>(
    () => api.get(maestroPuro ? '/academico/mis-grupos' : '/academico/grupo-materias').then((r) => r.data), [],
  );
  const [form, setForm] = useState(FORM_INICIAL);
  const [filtroPlantel, setFiltroPlantel] = useState('');
  const [error, setError] = useState(''); const [guardando, setGuardando] = useState(false); const mutando = useRef(false);

  const crear = async (e: FormEvent) => {
    e.preventDefault();
    if (mutando.current) return; mutando.current = true; setGuardando(true);
    setError('');
    try {
      await api.post('/calendario', {
        titulo: form.titulo,
        tipo: form.tipo,
        fechaInicio: new Date(form.fechaInicio).toISOString(),
        fechaFin: form.fechaFin ? new Date(form.fechaFin).toISOString() : undefined,
        descripcion: form.descripcion || undefined,
        plantelId: form.plantelId ? Number(form.plantelId) : undefined,
        grupoId: form.grupoId ? Number(form.grupoId) : undefined,
      });
      setForm(FORM_INICIAL);
      recargar();
    } catch (err) { setError(mensajeDeError(err)); } finally { mutando.current = false; setGuardando(false); }
  };

  const eliminar = async (evento: Evento) => {
    if (!await confirmacion.solicitar(`¿Eliminar el evento "${evento.titulo}"?`)) return;
    if (mutando.current) return; mutando.current = true; setGuardando(true);
    setError('');
    try { await api.delete(`/calendario/${evento.id}`); recargar(); }
    catch (err) { setError(mensajeDeError(err)); } finally { mutando.current = false; setGuardando(false); }
  };

  const filtrarEventos = async () => {
    setError('');
    try {
      consulta.current = { ...intervaloDias(desde, hasta), ...(filtroPlantel ? { plantelId: filtroPlantel } : {}) };
      recargar();
    } catch (err) { setError(mensajeDeError(err)); }
  };

  return (
    <>{confirmacion.elemento}
      <div className="fila"><div className="campo"><label htmlFor="cal-desde">Desde</label><input id="cal-desde" type="date" value={desde} onChange={(e) => setDesde(e.target.value)} /></div>
        <div className="campo"><label htmlFor="cal-hasta">Hasta</label><input id="cal-hasta" type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} /></div>
        <button disabled={cargando} onClick={filtrarEventos}>Consultar intervalo</button></div>
      <Encabezado titulo="Calendario académico" detalle="Exámenes, entregas, días festivos y avisos generales" />
      {(error || errorCarga) && <p role="alert" className="mensaje-error">{error || errorCarga}</p>}

      <section className="panel">
        <h2>Nuevo evento</h2>
        <form onSubmit={crear} className="fila">
          <div className="campo"><label htmlFor="cal-titulo">Título</label>
            <input id="cal-titulo" required value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} />
          </div>
          <div className="campo"><label htmlFor="cal-tipo">Tipo</label>
            <select id="cal-tipo" value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>
              <option>GENERAL</option><option>EXAMEN</option><option>ENTREGA</option><option>FESTIVO</option>
              <option>PAGO</option><option>JUNTA</option>
            </select>
          </div>
          <div className="campo"><label htmlFor="cal-plantel">Plantel</label><select id="cal-plantel" required={!esSuperadmin && !maestroPuro} disabled={maestroPuro} value={form.plantelId} onChange={(e) => setForm({ ...form, plantelId: e.target.value })}>{esSuperadmin && <option value="">Global (todos)</option>}{!esSuperadmin && <option value="">Selecciona…</option>}{planteles.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}</select></div>
          <div className="campo"><label htmlFor="cal-grupo">Grupo {maestroPuro ? '' : '(opcional)'}</label><select id="cal-grupo" required={maestroPuro} value={form.grupoId} onChange={(e) => setForm({ ...form, grupoId: e.target.value })}><option value="">Sin grupo</option>{Array.from(new Map(clases.map((c) => [c.grupo.id, c.grupo])).values()).map((g) => <option key={g.id} value={g.id}>{g.nombre}</option>)}</select></div>
          <div className="campo"><label htmlFor="cal-inicio">Inicio</label>
            <input id="cal-inicio" type="datetime-local" required value={form.fechaInicio} onChange={(e) => setForm({ ...form, fechaInicio: e.target.value })} />
          </div>
          <div className="campo"><label htmlFor="cal-fin">Fin (opcional)</label>
            <input id="cal-fin" type="datetime-local" min={form.fechaInicio} value={form.fechaFin} onChange={(e) => setForm({ ...form, fechaFin: e.target.value })} />
          </div>
          <div className="campo" style={{ flex: '1 1 220px' }}><label htmlFor="cal-descripcion">Descripción</label>
            <input id="cal-descripcion" value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} />
          </div>
          <button className="boton" disabled={guardando}>{guardando ? 'Guardando…' : 'Agregar al calendario'}</button>
        </form>
      </section>

      <div className="fila" style={{ marginBottom: 12 }}><div className="campo"><label htmlFor="cal-filtro">Ver plantel</label><select id="cal-filtro" value={filtroPlantel} onChange={(e) => setFiltroPlantel(e.target.value)}><option value="">Todos</option>{planteles.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}</select></div><button className="boton secundario" disabled={cargando} onClick={filtrarEventos}>Aplicar</button></div>

      <table className="tabla">
        <thead><tr><th>Fecha</th><th>Evento</th><th>Ámbito</th><th>Tipo</th><th>Descripción</th><th className="derecha">Acciones</th></tr></thead>
        <tbody>
          {eventos.map((ev) => (
            <tr key={ev.id}>
              <td>{fechaHora(ev.fechaInicio)}{ev.fechaFin ? ` — ${fechaHora(ev.fechaFin)}` : ''}</td>
              <td>{ev.titulo}</td>
              <td>{ev.plantel ? ev.plantel.nombre : <span className="sello ok">Global</span>}</td>
              <td><span className={`sello ${TONO[ev.tipo]}`}>{ev.tipo}</span></td>
              <td>{ev.descripcion ?? '—'}</td>
              <td className="derecha">
                <button className="boton peligro chico" disabled={guardando} onClick={() => eliminar(ev)}>Eliminar</button>
              </td>
            </tr>
          ))}
          {!cargando && eventos.length === 0 && (
            <tr><td className="vacio" colSpan={6}>Calendario vacío. Agrega el primer evento del ciclo.</td></tr>
          )}
        </tbody>
      </table>
    </>
  );
}
