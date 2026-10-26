import { CalendarioCiclo } from '../components/CalendarioCiclo';
import { useModuloTrabajo } from '../components/ModuloTrabajo';
import { Paginador } from '../components/Paginador';
import { useConfirmacion } from '../components/useConfirmacion';
import { FormEvent, useEffect, useRef, useState } from 'react';
import { api, mensajeDeError } from '../api/client';
import { Encabezado } from '../components/Encabezado';
import { useDatos } from '../hooks/useDatos';
import { diaLocal, fechaHora, intervaloDias } from '../utils/formato';
import { useAuth } from '../auth/AuthContext';

interface Evento {
  id: number;
  creadoPorId: number | null;
  grupoId: number | null;
  revision: string;
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
  const maestroPuro = sesion?.roles.includes('MAESTRO') && !sesion.roles.includes('ADMINISTRATIVO') && !sesion.roles.includes('FINANZAS') && !esSuperadmin;
  const [guardando,setGuardando] = useState(false), mutando = useRef(false);
  const trabajo = useModuloTrabajo(guardando), legado = trabajo.modo === 'legado', consultaVisible = legado || trabajo.modo === 'consulta';
  const pagina = Math.max(1,Number(trabajo.query.get('pagina')) || 1), desdeQuery = trabajo.query.get('desde') || diaLocal(), hastaQuery = trabajo.query.get('hasta') || diaLocal(new Date(Date.now()+90*86400000)), plantelQuery=trabajo.query.get('plantel') || '', buscarQuery=trabajo.query.get('buscar') || '';
  const [buscar,setBuscar] = useState(buscarQuery), [mensaje,setMensaje] = useState('');
  const permitirConsulta = useRef(legado);
  const [desde, setDesde] = useState(desdeQuery);
  const [hasta, setHasta] = useState(hastaQuery);
  const consulta = useRef<{ desde: string; hasta: string; plantelId?: string } | null>(null);
  if (!consulta.current) consulta.current = intervaloDias(desde, hasta);
  const { datos: resultado, cargando, error: errorCarga, recargar } = useDatos<{datos:Evento[];total:number}>(
    () => {
      if(!consultaVisible || !permitirConsulta.current) return Promise.resolve({datos:[],total:0});
      if(legado) return api.get('/calendario',{params:consulta.current}).then(r=>({datos:r.data,total:r.data.length}));
      return api.get<{datos:Evento[];total:number}>('/calendario/listado',{params:{...consulta.current,pagina,porPagina:10,buscar:buscarQuery}}).then(({data})=>data);
    }, {datos:[],total:0},
  );
  const eventos=resultado.datos,total=resultado.total;
  useEffect(() => {const actualizar=()=>recargar();window.addEventListener('calendario-cambio',actualizar);return()=>window.removeEventListener('calendario-cambio',actualizar);},[recargar]);
  const { datos: planteles } = useDatos<Plantel[]>(() => api.get('/planteles/mios').then((r) => r.data), []);
  const { datos: clases, recargar: cargarClases } = useDatos<GrupoMateria[]>(
    () => sesion?.roles.includes('ALUMNO') || (consultaVisible && !legado) ? Promise.resolve([]) : api.get(maestroPuro ? '/academico/mis-grupos' : '/academico/grupo-materias').then((r) => r.data), [],
  );
  const faseAnterior = useRef(consultaVisible);
  useEffect(()=>{if(!legado && faseAnterior.current && !consultaVisible) cargarClases();faseAnterior.current=consultaVisible;},[legado,consultaVisible,cargarClases]);
  const puedeEliminar = (evento: Evento) => {
    if (esSuperadmin) return true;
    if (maestroPuro) return evento.creadoPorId === sesion?.sub;
    return !!sesion?.roles.some(r=>['ADMINISTRATIVO','FINANZAS'].includes(r)) && evento.plantel !== null && planteles.some((plantel) => plantel.id === evento.plantel?.id);
  };
  const [form, setForm] = useState(FORM_INICIAL);
  const [editando, setEditando] = useState<Evento | null>(null);
  const fechaInput = (valor: string) => { const d = new Date(valor); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0,16); };
  const editar = (e: Evento) => { setEditando(e); setForm({ titulo: e.titulo, descripcion: e.descripcion ?? '', tipo: e.tipo, plantelId: String(e.plantel?.id ?? ''), grupoId: String(e.grupoId ?? ''), fechaInicio: fechaInput(e.fechaInicio), fechaFin: e.fechaFin ? fechaInput(e.fechaFin) : '' }); setError(''); if(!legado && trabajo.modo !== 'editar') trabajo.ir('editar',e.id); };
  const [filtroPlantel, setFiltroPlantel] = useState(plantelQuery);
  const [error, setError] = useState('');

  useEffect(() => { if (editando) document.getElementById('cal-titulo')?.focus(); }, [editando]);

  useEffect(()=>{
    if(legado || !consultaVisible) return;
    permitirConsulta.current = true;setDesde(desdeQuery);setHasta(hastaQuery);setFiltroPlantel(plantelQuery);setBuscar(buscarQuery);
    try {consulta.current={...intervaloDias(desdeQuery,hastaQuery),...(plantelQuery ? {plantelId:plantelQuery}: {})};recargar();}catch(e){setError(mensajeDeError(e));}
  },[legado,consultaVisible,desdeQuery,hastaQuery,plantelQuery,buscarQuery,pagina,recargar]);
  useEffect(()=>{
    if(legado) return;
    if(trabajo.modo === 'nuevo') {setEditando(null);setForm(FORM_INICIAL);}
    if(trabajo.modo !== 'editar' || !trabajo.id) return;
    let vigente = true;
    api.get<Evento>(`/calendario/${trabajo.id}`).then(({data})=>{if(vigente)editar(data);}).catch(e=>{if(vigente)setError(mensajeDeError(e));});
    return()=>{vigente=false;};
    // Inicializa únicamente al cambiar de registro; editar conserva la revisión optimista.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[legado,trabajo.modo,trabajo.id]);
  const crear = async (e: FormEvent) => {
    e.preventDefault();
    if (mutando.current) return;
    if (!form.titulo.trim()) { setError('Escribe el título del evento.'); return; }
    if (form.fechaFin && new Date(form.fechaFin) < new Date(form.fechaInicio)) { setError('El fin no puede ser anterior al inicio.'); return; }
    mutando.current = true; setGuardando(true);
    setError('');
    try {
      const datos = { ...(editando ? { revision: editando.revision } : {}),
        titulo: form.titulo.trim(),
        tipo: form.tipo,
        fechaInicio: new Date(form.fechaInicio).toISOString(),
        fechaFin: form.fechaFin ? new Date(form.fechaFin).toISOString() : editando ? null : undefined,
        descripcion: form.descripcion.trim() || (editando ? null : undefined),
        ...(!editando ? { plantelId: form.plantelId ? Number(form.plantelId) : undefined, grupoId: form.grupoId ? Number(form.grupoId) : undefined } : {}),
      };
      if (editando) await api.patch(`/calendario/${editando.id}`, datos);
      else await api.post('/calendario', datos);
      window.dispatchEvent(new Event('calendario-cambio'));
      trabajo.guardado();setMensaje('Evento guardado');
      setEditando(null); setForm(FORM_INICIAL);
      if(legado) recargar();else trabajo.ir('consulta');
    } catch (err) { setError(mensajeDeError(err)); } finally { mutando.current = false; setGuardando(false); }
  };

  const eliminar = async (evento: Evento) => {
    if (!await confirmacion.solicitar(`¿Eliminar el evento "${evento.titulo}"?`)) return;
    if (mutando.current) return; mutando.current = true; setGuardando(true);
    setError('');
    try { await api.delete(`/calendario/${evento.id}`); window.dispatchEvent(new Event('calendario-cambio')); recargar(); }
    catch (err) { setError(mensajeDeError(err)); } finally { mutando.current = false; setGuardando(false); }
  };

  const filtrarEventos = async () => {
    setError('');
    try {
      consulta.current = { ...intervaloDias(desde, hasta), ...(filtroPlantel ? { plantelId: filtroPlantel } : {}) };
      if(legado) recargar();else trabajo.actualizar({desde,hasta,plantel:filtroPlantel,buscar,pagina:'1'});
    } catch (err) { setError(mensajeDeError(err)); }
  };

  return (
    <>{confirmacion.elemento}
      {consultaVisible && <div className="fila"><div className="campo"><label htmlFor="cal-desde">Desde</label><input id="cal-desde" type="date" value={desde} onChange={(e) => setDesde(e.target.value)} /></div>
        <div className="campo"><label htmlFor="cal-hasta">Hasta</label><input id="cal-hasta" type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} /></div>
        <button disabled={cargando} onClick={filtrarEventos}>Consultar intervalo</button></div>}
      <CalendarioCiclo/>
      <Encabezado titulo="Calendario académico" detalle="Exámenes, entregas, días festivos y avisos generales" />
      {(error || errorCarga) && <p role="alert" className="mensaje-error">{error || errorCarga}</p>}

      {mensaje && <p role="status">{mensaje}</p>}
      {!sesion?.roles.includes('ALUMNO') && (legado || trabajo.modo === 'nuevo' || (trabajo.modo === 'editar' && editando?.id === trabajo.id)) && <section className="panel" aria-labelledby="cal-form-titulo">
        <h2 id="cal-form-titulo">{editando ? 'Editar evento' : 'Nuevo evento'}</h2>
        {editando && <p>La edición conserva el plantel y grupo. Si otra persona modifica el evento, recarga antes de volver a guardar.</p>}
        <form onSubmit={crear} className="fila" aria-busy={guardando}>
          <div className="campo"><label htmlFor="cal-titulo">Título</label>
            <input id="cal-titulo" disabled={guardando} maxLength={150} required value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} />
          </div>
          <div className="campo"><label htmlFor="cal-tipo">Tipo</label>
            <select id="cal-tipo" disabled={guardando} value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>
              <option>GENERAL</option><option>EXAMEN</option><option>ENTREGA</option><option>FESTIVO</option>
              <option>PAGO</option><option>JUNTA</option>
            </select>
          </div>
          <div className="campo"><label htmlFor="cal-plantel">Plantel</label><select id="cal-plantel" required={!esSuperadmin && !maestroPuro} disabled={maestroPuro || !!editando || guardando} value={form.plantelId} onChange={(e) => setForm({ ...form, plantelId: e.target.value })}>{esSuperadmin && <option value="">Global (todos)</option>}{!esSuperadmin && <option value="">Selecciona…</option>}{planteles.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}</select></div>
          <div className="campo"><label htmlFor="cal-grupo">Grupo {maestroPuro ? '' : '(opcional)'}</label><select id="cal-grupo" disabled={!!editando || guardando} required={maestroPuro} value={form.grupoId} onChange={(e) => setForm({ ...form, grupoId: e.target.value })}><option value="">Sin grupo</option>{Array.from(new Map(clases.map((c) => [c.grupo.id, c.grupo])).values()).map((g) => <option key={g.id} value={g.id}>{g.nombre}</option>)}</select></div>
          <div className="campo"><label htmlFor="cal-inicio">Inicio</label>
            <input id="cal-inicio" disabled={guardando} type="datetime-local" required value={form.fechaInicio} onChange={(e) => setForm({ ...form, fechaInicio: e.target.value })} />
          </div>
          <div className="campo"><label htmlFor="cal-fin">Fin (opcional)</label>
            <input id="cal-fin" disabled={guardando} type="datetime-local" min={form.fechaInicio} value={form.fechaFin} onChange={(e) => setForm({ ...form, fechaFin: e.target.value })} />
          </div>
          <div className="campo" style={{ flex: '1 1 220px' }}><label htmlFor="cal-descripcion">Descripción</label>
            <input id="cal-descripcion" disabled={guardando} value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} />
          </div>
          <button className="boton" disabled={guardando}>{guardando ? 'Guardando…' : editando ? 'Guardar evento' : 'Agregar al calendario'}</button>
          {editando && <button type="button" disabled={guardando} onClick={() => {if(!legado) trabajo.ir('consulta');else{setEditando(null);setForm(FORM_INICIAL);setError('');}}}>Cancelar edición</button>}
        </form>
      </section>}

      {consultaVisible && <><div className="fila" style={{ marginBottom: 12 }}><div className="campo"><label htmlFor="cal-filtro">Ver plantel</label><select id="cal-filtro" value={filtroPlantel} onChange={(e) => setFiltroPlantel(e.target.value)}><option value="">Todos</option>{planteles.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}</select></div><button className="boton secundario" disabled={cargando} onClick={filtrarEventos}>Aplicar</button></div>

      {!legado && <label>Buscar por título<input value={buscar} onChange={e=>setBuscar(e.target.value)} /></label>}
      <div className="tabla-contenedor" role="region" aria-label="Eventos del calendario" tabIndex={0}><table className="tabla">
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
                {puedeEliminar(ev)
                  ? <><button className="boton secundario chico" disabled={guardando} onClick={() => editar(ev)}>Editar</button><button className="boton peligro chico" disabled={guardando} onClick={() => eliminar(ev)}>Eliminar</button></>
                  : <span className="detalle">Solo lectura</span>}
              </td>
            </tr>
          ))}
          {!cargando && eventos.length === 0 && (
            <tr><td className="vacio" colSpan={6}>Calendario vacío. Agrega el primer evento del ciclo.</td></tr>
          )}
        </tbody>
      </table></div>
      {!legado && <Paginador total={total} pagina={pagina} porPagina={10} deshabilitado={cargando} onCambio={p=>trabajo.actualizar({pagina:String(p)})} />}
      </>}
    </>
  );
}
