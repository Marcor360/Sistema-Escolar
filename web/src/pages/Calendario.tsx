import { FormEvent, useState } from 'react';
import { api, mensajeDeError } from '../api/client';
import { Encabezado } from '../components/Encabezado';
import { useDatos } from '../hooks/useDatos';
import { fechaHora } from '../utils/formato';
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
  const { sesion } = useAuth();
  const esSuperadmin = sesion?.roles.includes('SUPERADMIN') ?? false;
  const maestroPuro = sesion?.roles.includes('MAESTRO') && !sesion.roles.includes('ADMINISTRATIVO') && !esSuperadmin;
  const { datos: eventos, cargando, error: errorCarga, recargar, setDatos: setEventos } = useDatos<Evento[]>(
    () => api.get('/calendario').then((r) => r.data),
    [],
  );
  const { datos: planteles } = useDatos<Plantel[]>(() => api.get('/planteles/mios').then((r) => r.data), []);
  const { datos: clases } = useDatos<GrupoMateria[]>(
    () => api.get(maestroPuro ? '/academico/mis-grupos' : '/academico/grupo-materias').then((r) => r.data), [],
  );
  const [form, setForm] = useState(FORM_INICIAL);
  const [filtroPlantel, setFiltroPlantel] = useState('');
  const [error, setError] = useState('');

  const crear = async (e: FormEvent) => {
    e.preventDefault();
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
    } catch (err) { setError(mensajeDeError(err)); }
  };

  const eliminar = async (evento: Evento) => {
    if (!confirm(`¿Eliminar el evento "${evento.titulo}"?`)) return;
    await api.delete(`/calendario/${evento.id}`);
    recargar();
  };

  return (
    <>
      <Encabezado titulo="Calendario académico" detalle="Exámenes, entregas, días festivos y avisos generales" />
      {(error || errorCarga) && <p className="mensaje-error">{error || errorCarga}</p>}

      <section className="panel">
        <h2>Nuevo evento</h2>
        <form onSubmit={crear} className="fila">
          <div className="campo"><label>Título</label>
            <input required value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} />
          </div>
          <div className="campo"><label>Tipo</label>
            <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>
              <option>GENERAL</option><option>EXAMEN</option><option>ENTREGA</option><option>FESTIVO</option>
              <option>PAGO</option><option>JUNTA</option>
            </select>
          </div>
          <div className="campo"><label>Plantel</label><select required={!esSuperadmin && !maestroPuro} disabled={maestroPuro} value={form.plantelId} onChange={(e) => setForm({ ...form, plantelId: e.target.value })}>{esSuperadmin && <option value="">Global (todos)</option>}{!esSuperadmin && <option value="">Selecciona…</option>}{planteles.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}</select></div>
          <div className="campo"><label>Grupo {maestroPuro ? '' : '(opcional)'}</label><select required={maestroPuro} value={form.grupoId} onChange={(e) => setForm({ ...form, grupoId: e.target.value })}><option value="">Sin grupo</option>{Array.from(new Map(clases.map((c) => [c.grupo.id, c.grupo])).values()).map((g) => <option key={g.id} value={g.id}>{g.nombre}</option>)}</select></div>
          <div className="campo"><label>Inicio</label>
            <input type="datetime-local" required value={form.fechaInicio} onChange={(e) => setForm({ ...form, fechaInicio: e.target.value })} />
          </div>
          <div className="campo"><label>Fin (opcional)</label>
            <input type="datetime-local" value={form.fechaFin} onChange={(e) => setForm({ ...form, fechaFin: e.target.value })} />
          </div>
          <div className="campo" style={{ flex: '1 1 220px' }}><label>Descripción</label>
            <input value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} />
          </div>
          <button className="boton">Agregar al calendario</button>
        </form>
      </section>

      <div className="fila" style={{ marginBottom: 12 }}><div className="campo"><label>Ver plantel</label><select value={filtroPlantel} onChange={(e) => setFiltroPlantel(e.target.value)}><option value="">Todos</option>{planteles.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}</select></div><button className="boton secundario" onClick={() => api.get('/calendario', { params: filtroPlantel ? { plantelId: filtroPlantel } : {} }).then((r) => setEventos(r.data))}>Aplicar</button></div>

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
                <button className="boton peligro chico" onClick={() => eliminar(ev)}>Eliminar</button>
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
