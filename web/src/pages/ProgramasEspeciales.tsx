import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api, mensajeDeError } from '../api/client';
import { PanelAccionesModulo } from '../components/PanelAccionesModulo';
import { Paginador } from '../components/Paginador';
import { SelectorBuscable } from '../components/SelectorBuscable';
import { ContextoAcademicoSelector, CONTEXTO_VACIO } from '../components/ContextoAcademicoSelector';
import { useConfirmacion } from '../components/useConfirmacion';
import { useDialogoMotivo } from '../components/useDialogoMotivo';
import { useSalidaPendiente } from '../components/useSalidaPendiente';
interface Programa { id: number; clave: string; nombre: string; tipo: string; estado: string; plantelId: number; cicloId: number; fechaInicio: string; fechaFin: string }
interface Grupo { id: number; nombre: string; activo: boolean; cupoManual: number; plantelId: number; programaEspecialId: number }
interface Materia { id: number; clave: string; nombre: string }
interface Clase { id: number; materia: Materia; docente: { id: number; nombre: string } | null }
interface Inscrito { id: number; alumnoId: number; matricula: string; nombre: string; estatus: string }
interface Pagina<T> { datos: T[]; total: number; pagina: number; porPagina: number }
function useRecurso<T>(ruta: string | null, params: Record<string, string | number> = {}) {
  const [data, setData] = useState<T | null>(null), [error, setError] = useState(''), [cargando, setCargando] = useState(false), [intento, setIntento] = useState(0);
  const clave = JSON.stringify(params);
  useEffect(() => { setData(null); if (!ruta) return; let activo = true; setCargando(true); setError('');
    api.get<T>(ruta, { params: JSON.parse(clave) }).then((r) => { if (activo) setData(r.data); }).catch((e) => { if (activo) setError(mensajeDeError(e)); }).finally(() => { if (activo) setCargando(false); });
    return () => { activo = false; };
  }, [ruta, clave, intento]);
  return { data, error, cargando, recargar: useCallback(() => setIntento((v) => v + 1), []) };
}
function EstadoCarga({ recurso }: { recurso: { error: string; cargando: boolean; recargar: () => void } }) {
  return <>{recurso.cargando && <p role="status">Cargando…</p>}{recurso.error && <p role="alert">{recurso.error}<button onClick={recurso.recargar}>Reintentar</button></p>}</>;
}
export default function ProgramasEspecialesPage() {
  const { id, grupo } = useParams();
  if (id === 'nuevo' || grupo === 'nuevo') return <Formulario programaId={id === 'nuevo' ? undefined : id} />;
  if (grupo && id) return <GrupoDetalle id={grupo} programaId={id} />;
  if (id) return <ProgramaDetalle id={id} />;
  return <Directorio />;
}
function Directorio() {
  const [q, setQ] = useSearchParams(), navigate = useNavigate();
  const consulta = q.get('vista') === 'consulta', pagina = Math.max(1, Number(q.get('pagina')) || 1), buscar = q.get('buscar') || '';
  const [termino, setTermino] = useState(buscar);
  const r = useRecurso<Pagina<Programa>>(consulta ? '/programas-especiales' : null, { pagina, porPagina: 10, buscar, ...(q.get('estado') ? { estado: q.get('estado')! } : {}) });
  useEffect(() => { if (termino.trim() === buscar) return; const timer = setTimeout(() => setQ((p) => { const n = new URLSearchParams(p); n.set('buscar', termino.trim()); n.delete('pagina'); return n; }, { replace: true }), 300); return () => clearTimeout(timer); }, [termino, buscar, setQ]);
  return <><header className="encabezado"><h1>Programas especiales</h1><p>Grupos e inscripciones manuales, independientes de la apertura de cartera ordinaria.</p></header>
    {!consulta ? <PanelAccionesModulo titulo="Gestionar programas" acciones={[
      { titulo: 'Registrar programa especial', detalle: 'Diplomado, certificación, especialización o curso extracurricular', ejecutar: () => navigate('/programas-especiales/nuevo') },
      { titulo: 'Consultar programas', detalle: 'Gestionar grupos, docentes, alumnos y cierres', ejecutar: () => setQ({ vista: 'consulta' }) },
    ]} /> : <><button onClick={() => setQ({})}>Volver a opciones</button><Link className="boton" to="/programas-especiales/nuevo">Registrar programa</Link>
      <label htmlFor="programa-buscar">Buscar programas</label><input id="programa-buscar" value={termino} onChange={(e) => setTermino(e.target.value)} />
      <label htmlFor="programa-estado">Estado</label><select id="programa-estado" value={q.get('estado') || ''} onChange={(e) => setQ({ vista: 'consulta', estado: e.target.value, buscar })}><option value="">Todos</option>{['ACTIVO','CERRADO','CANCELADO'].map((s) => <option key={s}>{s}</option>)}</select>
      <EstadoCarga recurso={r} /><div className="tabla-contenedor"><table className="tabla"><thead><tr><th>Clave</th><th>Programa</th><th>Tipo / estado</th><th>Gestión</th></tr></thead><tbody>{r.data?.datos.map((p) => <tr key={p.id}><td>{p.clave}</td><td>{p.nombre}</td><td>{p.tipo} · {p.estado}</td><td><Link to={`/programas-especiales/${p.id}`}>Abrir programa</Link></td></tr>)}{r.data && !r.data.datos.length && <tr><td colSpan={4}>Sin programas para esta consulta.</td></tr>}</tbody></table></div>
      <Paginador total={r.data?.total || 0} pagina={pagina} porPagina={10} deshabilitado={r.cargando} onCambio={(p) => setQ({ vista: 'consulta', buscar, estado: q.get('estado') || '', pagina: String(p) })} />
    </>}
  </>;
}
const inicial = { clave: '', nombre: '', plantelId: '', cicloId: '', tipo: 'DIPLOMADO', fechaInicio: '', fechaFin: '', cupoManual: '', materiaId: '', docenteId: '', turno: '' };
function Formulario({ programaId }: { programaId?: string }) {
  const navigate = useNavigate(), [form, setForm] = useState(inicial), [contexto, setContexto] = useState(CONTEXTO_VACIO), [usarContexto, setUsarContexto] = useState(false);
  const p = useRecurso<Programa>(programaId ? `/programas-especiales/${programaId}` : null), planteles = useRecurso<{ id: number; nombre: string }[]>(programaId ? null : '/planteles/mios'), ciclos = useRecurso<{ id: number; clave: string; estado: string }[]>(programaId ? null : '/academico/ciclos');
  const materias = useRecurso<Materia[]>(programaId ? '/academico/materias' : null);
  const [error, setError] = useState(''), [guardando, setGuardando] = useState(false), ocupado = useRef(false), guardado = useRef(false), titulo = useRef<HTMLHeadingElement>(null);
  const salida = useSalidaPendiente(JSON.stringify(form) !== JSON.stringify(inicial) || usarContexto, ocupado, guardado);
  useEffect(() => { titulo.current?.focus(); }, []);
  const volver = programaId ? `/programas-especiales/${programaId}` : '/programas-especiales?vista=consulta';
  const guardar = async (e: FormEvent) => {
    e.preventDefault(); if (ocupado.current) return; ocupado.current = true; setGuardando(true); setError('');
    try {
      if (programaId) await api.post(`/programas-especiales/${programaId}/grupos`, { nombre: form.nombre, cupoManual: Number(form.cupoManual), materiaId: Number(form.materiaId), docenteId: Number(form.docenteId), ...(form.turno ? { turno: form.turno } : {}), ...(usarContexto ? { nivelId: Number(contexto.nivelId), carreraId: Number(contexto.carreraId), periodoAcademicoId: Number(contexto.periodoAcademicoId) } : {}) });
      else await api.post('/programas-especiales', { nombre: form.nombre, clave: form.clave, tipo: form.tipo, plantelId: Number(form.plantelId), cicloId: Number(form.cicloId), fechaInicio: form.fechaInicio, fechaFin: form.fechaFin });
      guardado.current = true; navigate(volver, { replace: true });
    } catch (err) { setError(mensajeDeError(err)); } finally { ocupado.current = false; setGuardando(false); }
  };
  const campo = (key: keyof typeof inicial) => ({ value: form[key], onChange: (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [key]: e.target.value }) });
  const listo = programaId ? Boolean(p.data && p.data.estado === 'ACTIVO' && materias.data) : Boolean(planteles.data && ciclos.data);
  return <main className="contenido edicion-enfocada">{salida}<h1 ref={titulo} tabIndex={-1}>{programaId ? 'Crear grupo especial manual' : 'Registrar programa especial'}</h1><button disabled={guardando} onClick={() => navigate(volver)}>Cancelar y volver</button>
    {[p, planteles, ciclos, materias].map((r, i) => <EstadoCarga key={i} recurso={r} />)}{error && <p role="alert">{error}</p>}
    {p.data && <p>{p.data.nombre} · {p.data.estado}. El cupo es manual; no aplica la regla de grupos regulares.</p>}
    {listo && <form className="panel" onSubmit={guardar}><fieldset disabled={guardando}><legend>{programaId ? 'Grupo y primera asignatura' : 'Datos del programa'}</legend>
      <label htmlFor="esp-nombre">Nombre</label><input id="esp-nombre" required maxLength={programaId ? 40 : 120} {...campo('nombre')} />
      {!programaId ? <>
        <label htmlFor="esp-clave">Clave</label><input id="esp-clave" required maxLength={20} {...campo('clave')} />
        <label htmlFor="esp-plantel">Plantel</label><select id="esp-plantel" required value={form.plantelId} onChange={(e) => setForm({ ...form, plantelId: e.target.value })}><option value="">Selecciona…</option>{planteles.data?.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}</select>
        <label htmlFor="esp-ciclo">Ciclo aplicable</label><select id="esp-ciclo" required value={form.cicloId} onChange={(e) => setForm({ ...form, cicloId: e.target.value })}><option value="">Selecciona…</option>{ciclos.data?.filter((c) => ['ACTIVO','PREPARACION'].includes(c.estado)).map((c) => <option key={c.id} value={c.id}>{c.clave}</option>)}</select>
        <label htmlFor="esp-tipo">Tipo de programa</label><select id="esp-tipo" value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>{['DIPLOMADO','CERTIFICACION','ESPECIALIZACION','EXTRACURRICULAR'].map((t) => <option key={t}>{t}</option>)}</select>
        <label htmlFor="esp-inicio">Fecha de inicio</label><input id="esp-inicio" type="date" required {...campo('fechaInicio')} />
        <label htmlFor="esp-fin">Fecha de fin</label><input id="esp-fin" type="date" min={form.fechaInicio} required {...campo('fechaFin')} />
      </> : <>
        <label htmlFor="esp-cupo">Cupo manual autorizado</label><input id="esp-cupo" type="number" required min={1} max={10000} {...campo('cupoManual')} />
        <label htmlFor="esp-turno">Turno</label><select id="esp-turno" value={form.turno} onChange={(e) => setForm({ ...form, turno: e.target.value })}><option value="">Sin turno asignado</option><option value="MATUTINO">Matutino</option><option value="VESPERTINO">Vespertino</option></select>
        <label htmlFor="esp-materia">Primera asignatura</label><select id="esp-materia" required value={form.materiaId} onChange={(e) => setForm({ ...form, materiaId: e.target.value })}><option value="">Selecciona…</option>{materias.data?.map((m) => <option key={m.id} value={m.id}>{m.clave} · {m.nombre}</option>)}</select>
        <SelectorBuscable<{ id: number; numEmpleado: string; estatus: string; usuario: { nombre: string; apellidoPaterno: string } }> ruta="/docentes" etiqueta="Docente existente" valor={form.docenteId} cambiar={(docenteId) => setForm({ ...form, docenteId })} filtros={{ plantelId: p.data!.plantelId }} texto={(d) => `${d.numEmpleado} · ${d.usuario.nombre} ${d.usuario.apellidoPaterno} · ${d.estatus}`} />
        <label><input type="checkbox" checked={usarContexto} onChange={(e) => { setUsarContexto(e.target.checked); if (!e.target.checked) setContexto(CONTEXTO_VACIO); }} />Asignar contexto de nivel, carrera/plan y periodo</label>
        {usarContexto && <ContextoAcademicoSelector plantelId={String(p.data!.plantelId)} cicloId={String(p.data!.cicloId)} valor={contexto} cambiar={setContexto} />}
      </>}
      <button className="boton" disabled={guardando}>{guardando ? 'Guardando…' : programaId ? 'Crear grupo especial' : 'Guardar programa'}</button>
    </fieldset></form>}
  </main>;
}
function ProgramaDetalle({ id }: { id: string }) {
  const p = useRecurso<Programa>(`/programas-especiales/${id}`), [pagina, setPagina] = useState(1), grupos = useRecurso<Pagina<Grupo>>(`/programas-especiales/${id}/grupos`, { pagina, porPagina: 10 });
  const dialogo = useDialogoMotivo(), [mensaje, setMensaje] = useState('');
  const terminar = (accion: 'cerrar' | 'cancelar') => dialogo.abrir({ titulo: accion === 'cerrar' ? 'Cerrar programa' : 'Cancelar programa', advertencia: 'Se desactivarán sus grupos y las inscripciones especiales. Se conserva el historial y no se modifica la inscripción regular ni se anulan cargos.', ejecutar: async (motivo) => { await api.post(`/programas-especiales/${id}/${accion}`, { confirmado: true, motivo }); p.recargar(); grupos.recargar(); setMensaje('Programa terminado; historial conservado.'); } });
  return <>{dialogo.elemento}<h1>{p.data?.nombre || 'Programa especial'}</h1><Link to="/programas-especiales?vista=consulta">Volver a programas</Link><EstadoCarga recurso={p} />
    {p.data && <><p>{p.data.tipo} · {p.data.estado} · {p.data.fechaInicio} a {p.data.fechaFin}</p><p>Los cobros adicionales se gestionan por Finanzas según las reglas aprobadas; este módulo no genera cargos.</p>
      {p.data.estado === 'ACTIVO' && <><Link className="boton" to={`/programas-especiales/${id}/grupos/nuevo`}>Crear grupo manual</Link><button onClick={() => terminar('cerrar')}>Cerrar programa</button><button onClick={() => terminar('cancelar')}>Cancelar programa</button></>}
      {mensaje && <p role="status">{mensaje}</p>}<h2>Grupos especiales</h2><EstadoCarga recurso={grupos} />
      <div className="tabla-contenedor"><table className="tabla"><thead><tr><th>Grupo</th><th>Cupo</th><th>Estado</th><th>Gestión</th></tr></thead><tbody>{grupos.data?.datos.map((g) => <tr key={g.id}><td>{g.nombre}</td><td>{g.cupoManual}</td><td>{g.activo ? 'Activo' : 'Inactivo'}</td><td><Link to={`/programas-especiales/${id}/grupos/${g.id}`}>Asignaturas e inscripciones</Link></td></tr>)}{grupos.data && !grupos.data.datos.length && <tr><td colSpan={4}>Sin grupos. Crea uno manualmente para iniciar.</td></tr>}</tbody></table></div>
      <Paginador total={grupos.data?.total || 0} pagina={pagina} porPagina={10} onCambio={setPagina} />
    </>}
  </>;
}
function GrupoDetalle({ id, programaId }: { id: string; programaId: string }) {
  const g = useRecurso<Grupo>(`/programas-especiales/grupos/${id}`), p = useRecurso<Programa>(`/programas-especiales/${programaId}`), clases = useRecurso<Clase[]>(`/programas-especiales/grupos/${id}/asignaturas`), [pagina, setPagina] = useState(1), inscritos = useRecurso<Pagina<Inscrito>>(`/programas-especiales/grupos/${id}/inscripciones`, { pagina, porPagina: 10 });
  const materias = useRecurso<Materia[]>('/academico/materias'), [materiaId, setMateriaId] = useState(''), [docenteId, setDocenteId] = useState(''), [alumnoId, setAlumnoId] = useState(''), [claseId, setClaseId] = useState<number | null>(null), [cupo, setCupo] = useState('');
  const [error, setError] = useState(''), [mensaje, setMensaje] = useState(''), [enviando, setEnviando] = useState(false), ocupado = useRef(false);
  const confirmar = useConfirmacion(), dialogo = useDialogoMotivo();
  const operar = async (fn: () => Promise<unknown>, aviso: string) => {
    if (ocupado.current || !await confirmar.solicitar(aviso)) return; ocupado.current = true; setEnviando(true); setError('');
    try { await fn(); g.recargar(); clases.recargar(); inscritos.recargar(); setMensaje('Operación registrada.'); } catch (e) { setError(mensajeDeError(e)); } finally { ocupado.current = false; setEnviando(false); }
  };
  const asignar = (e: FormEvent) => { e.preventDefault(); void operar(async () => { const body = { materiaId: Number(materiaId), docenteId: Number(docenteId) }; if (claseId) await api.patch(`/programas-especiales/grupos/${id}/asignaturas/${claseId}`, body); else await api.post(`/programas-especiales/grupos/${id}/asignaturas`, body); setClaseId(null); setMateriaId(''); setDocenteId(''); }, '¿Confirmar la asignatura y el docente del grupo especial?'); };
  const inscribir = (e: FormEvent) => { e.preventDefault(); void operar(async () => { await api.post(`/programas-especiales/grupos/${id}/inscripciones`, { alumnoId: Number(alumnoId) }); setAlumnoId(''); }, '¿Inscribir manualmente al alumno en este grupo especial? Su grupo regular no cambia.'); };
  const baja = (i: Inscrito) => dialogo.abrir({ titulo: `Baja especial de ${i.matricula}`, advertencia: 'Solo afecta a este grupo especial y conserva notas e historial.', ejecutar: async (motivo) => { await api.post(`/programas-especiales/grupos/${id}/inscripciones/${i.id}/baja`, { confirmado: true, motivo }); inscritos.recargar(); } });
  if (g.data && g.data.programaEspecialId !== Number(programaId)) return <p role="alert">El grupo no pertenece al programa seleccionado.</p>;
  const activo = g.data?.activo && p.data?.estado === 'ACTIVO';
  return <>{confirmar.elemento}{dialogo.elemento}<h1>{g.data?.nombre || 'Grupo especial'}</h1><Link to={`/programas-especiales/${programaId}`}>Volver al programa</Link><EstadoCarga recurso={g} /><EstadoCarga recurso={p} />
    {error && <p role="alert">{error}</p>}{mensaje && <p role="status">{mensaje}</p>}
    {g.data && <><p>Grupo especial · Cupo manual {g.data.cupoManual} · {activo ? 'Activo' : 'Inactivo'}</p>
      {activo && <form onSubmit={(e) => { e.preventDefault(); void operar(() => api.patch(`/programas-especiales/grupos/${id}`, { cupoManual: Number(cupo) }), '¿Actualizar el cupo manual autorizado?'); }}><label htmlFor="nuevo-cupo">Nuevo cupo manual</label><input id="nuevo-cupo" type="number" min={1} max={10000} required value={cupo} onChange={(e) => setCupo(e.target.value)} /><button disabled={enviando}>Actualizar cupo</button></form>}
      <h2>Asignaturas y docentes</h2><EstadoCarga recurso={clases} />{clases.data?.map((c) => <p key={c.id}>{c.materia.clave} · {c.materia.nombre} · {c.docente?.nombre || 'Sin docente'} {activo && <button disabled={enviando} onClick={() => { setClaseId(c.id); setMateriaId(String(c.materia.id)); setDocenteId(c.docente ? String(c.docente.id) : ''); }}>Reasignar docente</button>}</p>)}
      {activo && <form className="panel" onSubmit={asignar}><fieldset disabled={enviando}><legend>{claseId ? 'Reasignar docente' : 'Añadir asignatura'}</legend><EstadoCarga recurso={materias} />
        <label htmlFor="agregar-asignatura">Asignatura</label><select id="agregar-asignatura" required disabled={Boolean(claseId)} value={materiaId} onChange={(e) => setMateriaId(e.target.value)}><option value="">Selecciona…</option>{materias.data?.map((m) => <option key={m.id} value={m.id}>{m.clave} · {m.nombre}</option>)}</select>
        <SelectorBuscable<{ id: number; numEmpleado: string; usuario: { nombre: string } }> ruta="/docentes" etiqueta="Docente existente" valor={docenteId} cambiar={setDocenteId} filtros={{ plantelId: g.data.plantelId }} texto={(d) => `${d.numEmpleado} · ${d.usuario.nombre}`} /><button disabled={enviando}>Guardar asignatura</button>{claseId && <button type="button" onClick={() => { setClaseId(null); setMateriaId(''); setDocenteId(''); }}>Cancelar reasignación</button>}
      </fieldset></form>}
      <h2>Inscripciones manuales</h2><EstadoCarga recurso={inscritos} />{activo && <form className="panel" onSubmit={inscribir}><fieldset disabled={enviando}><legend>Inscribir alumno existente</legend><SelectorBuscable<{ id: number; matricula: string; usuario: { nombre: string; apellidoPaterno: string } }> ruta="/alumnos" etiqueta="Alumno existente" valor={alumnoId} cambiar={setAlumnoId} filtros={{ plantelId: g.data.plantelId }} texto={(a) => `${a.matricula} · ${a.usuario.nombre} ${a.usuario.apellidoPaterno}`} /><button disabled={enviando}>Inscribir en grupo especial</button></fieldset></form>}
      <div className="tabla-contenedor"><table className="tabla"><thead><tr><th>Matrícula</th><th>Alumno</th><th>Estado</th><th>Acción</th></tr></thead><tbody>{inscritos.data?.datos.map((i) => <tr key={i.id}><td>{i.matricula}</td><td>{i.nombre}</td><td>{i.estatus}</td><td>{activo && i.estatus === 'ACTIVA' && <button disabled={enviando} onClick={() => baja(i)}>Dar de baja especial</button>}</td></tr>)}{inscritos.data && !inscritos.data.datos.length && <tr><td colSpan={4}>Sin inscripciones en este grupo especial.</td></tr>}</tbody></table></div>
      <Paginador total={inscritos.data?.total || 0} pagina={pagina} porPagina={10} onCambio={setPagina} />
    </>}
  </>;
}
