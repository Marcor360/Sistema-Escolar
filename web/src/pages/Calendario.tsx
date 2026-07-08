import { FormEvent, useState } from 'react';
import { api, mensajeDeError } from '../api/client';
import { Encabezado } from '../components/Encabezado';
import { useDatos } from '../hooks/useDatos';
import { fechaHora } from '../utils/formato';

interface Evento {
  id: number;
  titulo: string;
  descripcion: string | null;
  tipo: 'GENERAL' | 'EXAMEN' | 'ENTREGA' | 'FESTIVO';
  fechaInicio: string;
  fechaFin: string | null;
}

const FORM_INICIAL = { titulo: '', tipo: 'GENERAL', fechaInicio: '', fechaFin: '', descripcion: '' };
const TONO: Record<Evento['tipo'], string> = { GENERAL: 'neutro', EXAMEN: 'mal', ENTREGA: 'aviso', FESTIVO: 'ok' };

export default function CalendarioPage() {
  const { datos: eventos, cargando, error: errorCarga, recargar } = useDatos<Evento[]>(
    () => api.get('/calendario').then((r) => r.data),
    [],
  );
  const [form, setForm] = useState(FORM_INICIAL);
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
            </select>
          </div>
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

      <table className="tabla">
        <thead><tr><th>Fecha</th><th>Evento</th><th>Tipo</th><th>Descripción</th><th className="derecha">Acciones</th></tr></thead>
        <tbody>
          {eventos.map((ev) => (
            <tr key={ev.id}>
              <td>{fechaHora(ev.fechaInicio)}{ev.fechaFin ? ` — ${fechaHora(ev.fechaFin)}` : ''}</td>
              <td>{ev.titulo}</td>
              <td><span className={`sello ${TONO[ev.tipo]}`}>{ev.tipo}</span></td>
              <td>{ev.descripcion ?? '—'}</td>
              <td className="derecha">
                <button className="boton peligro chico" onClick={() => eliminar(ev)}>Eliminar</button>
              </td>
            </tr>
          ))}
          {!cargando && eventos.length === 0 && (
            <tr><td className="vacio" colSpan={5}>Calendario vacío. Agrega el primer evento del ciclo.</td></tr>
          )}
        </tbody>
      </table>
    </>
  );
}
