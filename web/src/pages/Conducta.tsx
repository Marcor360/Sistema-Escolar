import { FormEvent, useCallback, useEffect, useState } from 'react';
import { api, mensajeDeError } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { SelectorBuscable } from '../components/SelectorBuscable';
import { Paginador } from '../components/Paginador';
import { Encabezado } from '../components/Encabezado';
import { fechaHora } from '../utils/formato';
interface Grupo { id: number; nombre: string; ciclo: { clave: string }; plantel: { nombre: string } }
interface Inscrito { alumnoId: number; alumno: { matricula: string; usuario: { nombre: string; apellidoPaterno: string } } }
interface Incidencia { id: number; alumnoId: number; grupoId: number; tipo: string; gravedad: string; descripcion: string; estado: string; fecha: string; seguimientos?: { id: number; nota: string; motivo: string; estado: string; fecha: string }[] }
const inicial = { alumnoId: '', tipo: '', gravedad: 'LEVE', descripcion: '' };
export default function ConductaPage() {
  const { tieneRol } = useAuth(); const control = tieneRol('ADMINISTRATIVO');
  const [grupoId, setGrupoId] = useState(''); const [gruposDocente, setGruposDocente] = useState<Grupo[]>([]);
  const [alumnos, setAlumnos] = useState<Inscrito[]>([]); const [form, setForm] = useState(inicial);
  const [resultado, setResultado] = useState<{ datos: Incidencia[]; total: number; pagina: number }>({ datos: [], total: 0, pagina: 1 });
  const [detalle, setDetalle] = useState<Incidencia | null>(null); const [seguimiento, setSeguimiento] = useState({ nota: '', motivo: '', estado: 'EN_SEGUIMIENTO' });
  const [cicloId, setCicloId] = useState(''); const [ciclos, setCiclos] = useState<{ id: number; clave: string }[]>([]);
  const [error, setError] = useState(''); const [mensaje, setMensaje] = useState(''); const [enviando, setEnviando] = useState(false);
  const cargar = useCallback(async (pagina = 1, ciclo = '') => { try { const { data } = await api.get('/conducta/incidencias', { params: { pagina, porPagina: 20, ...(ciclo ? { cicloId: ciclo } : {}) } }); setResultado(data); } catch (err) { setError(mensajeDeError(err)); } }, []);
  useEffect(() => { void cargar(); api.get('/academico/ciclos').then(({ data }) => setCiclos(data)).catch((err) => setError(mensajeDeError(err)));
    if (!control) api.get<{ grupo: Grupo }[]>('/academico/mis-grupos').then(({ data }) => setGruposDocente([...new Map(data.map((c) => [c.grupo.id, c.grupo])).values()])).catch((err) => setError(mensajeDeError(err)));
  }, [cargar, control]);
  useEffect(() => { setAlumnos([]); setForm((f) => ({ ...f, alumnoId: '' })); if (!grupoId) return; let vigente = true;
    api.get<Inscrito[]>(`/academico/grupos/${grupoId}/alumnos`).then(({ data }) => { if (vigente) setAlumnos(data); }).catch((err) => { if (vigente) setError(mensajeDeError(err)); }); return () => { vigente = false; };
  }, [grupoId]);
  const abrir = async (id: number) => { try { const { data } = await api.get<Incidencia>(`/conducta/incidencias/${id}`); setDetalle(data); } catch (err) { setError(mensajeDeError(err)); } };
  const guardar = async (e: FormEvent, esSeguimiento = false) => {
    e.preventDefault(); if (enviando || (esSeguimiento && !detalle)) return; setEnviando(true); setError(''); setMensaje('');
    try {
      if (esSeguimiento) { await api.post(`/conducta/incidencias/${detalle!.id}/seguimientos`, seguimiento); setSeguimiento({ nota: '', motivo: '', estado: 'EN_SEGUIMIENTO' }); await abrir(detalle!.id); }
      else { await api.post('/conducta/incidencias', { ...form, alumnoId: Number(form.alumnoId), grupoId: Number(grupoId), fecha: new Date().toISOString() }); setForm(inicial); }
      setMensaje('Registro interno guardado'); await cargar(1, cicloId);
    } catch (err) { setError(mensajeDeError(err)); } finally { setEnviando(false); }
  };
  return <><Encabezado titulo="Conducta e incidencias" detalle="Uso exclusivo del personal autorizado. Estas notas no se publican al alumno ni se envían por push." />
    {error && <p role="alert" className="mensaje-error">{error}</p>}{mensaje && <p role="status" className="mensaje-ok">{mensaje}</p>}
    <section className="panel"><h2>Registrar incidencia</h2><form onSubmit={guardar}>
      {control ? <SelectorBuscable<Grupo> ruta="/academico/grupos" valor={grupoId} cambiar={setGrupoId} etiqueta="Grupo vigente" texto={(g) => `${g.nombre} · ${g.ciclo.clave} · ${g.plantel.nombre}`} /> : <div className="campo"><label htmlFor="grupo-incidencia">Grupo</label><select id="grupo-incidencia" required value={grupoId} onChange={(e) => setGrupoId(e.target.value)}><option value="">Selecciona…</option>{gruposDocente.map((g) => <option key={g.id} value={g.id}>{g.nombre} · {g.ciclo.clave}</option>)}</select></div>}
      <div className="campo"><label htmlFor="alumno-incidencia">Alumno inscrito</label><select id="alumno-incidencia" required value={form.alumnoId} onChange={(e) => setForm({ ...form, alumnoId: e.target.value })}><option value="">Selecciona…</option>{alumnos.map((a) => <option key={a.alumnoId} value={a.alumnoId}>{a.alumno.matricula} — {a.alumno.usuario.nombre} {a.alumno.usuario.apellidoPaterno}</option>)}</select></div>
      <div className="campo"><label htmlFor="tipo-incidencia">Tipo</label><input id="tipo-incidencia" required maxLength={40} value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })} /></div>
      <div className="campo"><label htmlFor="gravedad-incidencia">Gravedad</label><select id="gravedad-incidencia" value={form.gravedad} onChange={(e) => setForm({ ...form, gravedad: e.target.value })}><option>LEVE</option><option>MEDIA</option><option>GRAVE</option></select></div>
      <div className="campo"><label htmlFor="descripcion-incidencia">Descripción interna</label><textarea id="descripcion-incidencia" required minLength={3} maxLength={2000} value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} /></div><button className="boton" disabled={enviando}>Guardar incidencia</button>
    </form></section>
    <section className="panel"><h2>Seguimiento</h2><label htmlFor="historial-incidencias">Ciclo del historial</label><select id="historial-incidencias" value={cicloId} onChange={(e) => { setCicloId(e.target.value); setDetalle(null); void cargar(1, e.target.value); }}><option value="">Vigente</option>{ciclos.map((c) => <option key={c.id} value={c.id}>{c.clave}</option>)}</select>
      <table className="tabla"><thead><tr><th>Registro</th><th>Alumno / Grupo</th><th>Tipo</th><th>Gravedad</th><th>Estado</th><th>Fecha</th><th>Acción</th></tr></thead><tbody>{resultado.datos.map((i) => <tr key={i.id}><td>{i.id}</td><td>{i.alumnoId} / {i.grupoId}</td><td>{i.tipo}</td><td>{i.gravedad}</td><td>{i.estado}</td><td>{fechaHora(i.fecha)}</td><td><button onClick={() => abrir(i.id)}>Consultar seguimiento</button></td></tr>)}</tbody></table><Paginador total={resultado.total} pagina={resultado.pagina} porPagina={20} onCambio={(p) => cargar(p, cicloId)} />
    </section>
    {detalle && <section className="panel"><h2>Incidencia {detalle.id}</h2><p>{detalle.descripcion}</p>{detalle.seguimientos?.map((s) => <article key={s.id}><h3>{s.estado} · {fechaHora(s.fecha)}</h3><p>{s.nota}</p><p>Motivo: {s.motivo}</p></article>)}
      {!['CERRADA', 'ANULADA'].includes(detalle.estado) && <form onSubmit={(e) => guardar(e, true)}><div className="campo"><label htmlFor="nota-seguimiento">Nota interna</label><textarea id="nota-seguimiento" required minLength={3} maxLength={2000} value={seguimiento.nota} onChange={(e) => setSeguimiento({ ...seguimiento, nota: e.target.value })} /></div><div className="campo"><label htmlFor="motivo-seguimiento">Motivo</label><input id="motivo-seguimiento" required minLength={3} maxLength={500} value={seguimiento.motivo} onChange={(e) => setSeguimiento({ ...seguimiento, motivo: e.target.value })} /></div><label htmlFor="estado-seguimiento">Nuevo estado</label><select id="estado-seguimiento" value={seguimiento.estado} onChange={(e) => setSeguimiento({ ...seguimiento, estado: e.target.value })}>{['ABIERTA', 'EN_SEGUIMIENTO', ...(control ? ['CERRADA', 'ANULADA'] : [])].map((s) => <option key={s}>{s}</option>)}</select><button className="boton" disabled={enviando}>Guardar seguimiento</button></form>}
    </section>}</>;
}
