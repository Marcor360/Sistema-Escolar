import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { useBeforeUnload, useBlocker, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api, mensajeDeError } from '../api/client';
import { PanelAccionesModulo } from '../components/PanelAccionesModulo';
import { Paginador } from '../components/Paginador';
import { SelectorBuscable } from '../components/SelectorBuscable';
import { useConfirmacion } from '../components/useConfirmacion';
const tipos = ['niveles', 'carreras', 'periodos'] as const;
type Tipo = typeof tipos[number];
const etiquetas = { niveles: 'Niveles académicos', carreras: 'Carreras y planes', periodos: 'Periodos académicos' };
interface Registro { id: number; nombre: string; clave: string; activo: boolean; plantelId: number; versionPlan?: string; tipo?: string; numero?: number }
const vacio = { clave: '', nombre: '', plantelId: '', nivelId: '', carreraId: '', cicloId: '', versionPlan: '', tipo: 'SEMESTRAL', numero: '1', fechaInicio: '', fechaFin: '', activo: true };
export default function CatalogosAcademicosPage() {
  const params = useParams();
  if (params.tipo && tipos.includes(params.tipo as Tipo) && params.id) return <Formulario tipo={params.tipo as Tipo} id={params.id} />;
  return <Directorio />;
}
function Directorio() {
  const location = useLocation();
  const navigate = useNavigate(); const [q, setQ] = useSearchParams();
  const tipo = tipos.includes(q.get('tipo') as Tipo) ? q.get('tipo') as Tipo : null;
  const pagina = Math.max(1, Number(q.get('pagina')) || 1), plantelId = q.get('plantel') || '', buscar = q.get('buscar') || '';
  const [termino, setTermino] = useState(buscar);
  const [planteles, setPlanteles] = useState<{ id: number; nombre: string }[]>([]);
  const [resultado, setResultado] = useState<{ datos: Registro[]; total: number }>({ datos: [], total: 0 });
  const [error, setError] = useState(''), [cargando, setCargando] = useState(false), [intento, setIntento] = useState(0);
  useEffect(() => { let activo = true; api.get('/planteles/mios').then(({ data }) => { if (activo) setPlanteles(data); }).catch((err) => { if (activo) setError(mensajeDeError(err)); }); return () => { activo = false; }; }, []);
  useEffect(() => {
    if (!tipo) return;
    let activo = true; setCargando(true); setError('');
    api.get(`/academico/catalogos/${tipo}`, { params: { pagina, porPagina: 10, ...(plantelId ? { plantelId } : {}), ...(buscar ? { buscar } : {}), inactivos: 'true' } })
      .then(({ data }) => { if (activo) setResultado(data); }).catch((err) => { if (activo) setError(mensajeDeError(err)); }).finally(() => { if (activo) setCargando(false); });
    return () => { activo = false; };
  }, [tipo, pagina, plantelId, buscar, intento]);
  useEffect(() => { if (termino === buscar) return; const timer = setTimeout(() => setQ((p) => { const n = new URLSearchParams(p); n.set('buscar', termino.trim()); n.delete('pagina'); return n; }, { replace: true }), 300); return () => clearTimeout(timer); }, [termino, buscar, setQ]);
  const cambiar = (campo: string, valor: string) => setQ((p) => { const n = new URLSearchParams(p); n.set(campo, valor); if (campo !== 'pagina') n.delete('pagina'); return n; });
  return <><header className="encabezado"><h1>Catálogos académicos</h1><p>Configuración institucional por plantel; los datos históricos se conservan.</p></header>
    {location.state?.mensaje && <p role="status">{location.state.mensaje}</p>}
    {error && <p role="alert">{error}<button onClick={() => setIntento((n) => n + 1)}>Reintentar</button></p>}
    {!tipo ? <PanelAccionesModulo titulo="Selecciona un catálogo" acciones={tipos.map((t) => ({ titulo: etiquetas[t], detalle: 'Consultar, registrar o editar', ejecutar: () => cambiar('tipo', t) }))} /> : <>
      <button onClick={() => setQ({})}>Volver a catálogos</button><h2>{etiquetas[tipo]}</h2>
      <button className="boton" onClick={() => navigate(`/catalogos-academicos/${tipo}/nuevo`)}>Registrar</button>
      <label htmlFor="catalogo-plantel">Plantel</label><select id="catalogo-plantel" value={plantelId} onChange={(e) => cambiar('plantel', e.target.value)}><option value="">Todos los permitidos</option>{planteles.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}</select>
      <label htmlFor="catalogo-buscar">Buscar por clave o nombre</label><input id="catalogo-buscar" value={termino} onChange={(e) => setTermino(e.target.value)} />
      {cargando && <p role="status">Cargando catálogo…</p>}
      <div className="tabla-contenedor"><table className="tabla"><thead><tr><th>Clave</th><th>Nombre / plan</th><th>Estado</th><th>Acción</th></tr></thead><tbody>{resultado.datos.map((r) => <tr key={r.id}><td>{r.clave}</td><td>{r.nombre}{r.versionPlan && ` · ${r.versionPlan}`}</td><td>{r.activo ? 'Activo' : 'Inactivo'}</td><td><button onClick={() => navigate(`/catalogos-academicos/${tipo}/${r.id}`)}>Editar</button></td></tr>)}{!cargando && !resultado.datos.length && <tr><td colSpan={4}>Sin registros. Registra el catálogo aprobado por la institución.</td></tr>}</tbody></table></div>
      <Paginador total={resultado.total} pagina={pagina} porPagina={10} deshabilitado={cargando} onCambio={(p) => cambiar('pagina', String(p))} />
    </>}
  </>;
}
function Formulario({ tipo, id }: { tipo: Tipo; id: string }) {
  const navigate = useNavigate(), nuevo = id === 'nuevo';
  const [form, setForm] = useState(vacio), [base, setBase] = useState(vacio);
  const [planteles, setPlanteles] = useState<{ id: number; nombre: string }[]>([]), [ciclos, setCiclos] = useState<{ id: number; clave: string }[]>([]);
  const [error, setError] = useState(''), [cargando, setCargando] = useState(true), [guardando, setGuardando] = useState(false), [intento, setIntento] = useState(0);
  const ocupado = useRef(false), guardado = useRef(false), titulo = useRef<HTMLHeadingElement>(null);
  const confirmacion = useConfirmacion(), solicitar = useRef(confirmacion.solicitar); solicitar.current = confirmacion.solicitar;
  const sucio = JSON.stringify(form) !== JSON.stringify(base);
  const blocker = useBlocker(() => !guardado.current && (sucio || ocupado.current));
  useBeforeUnload(useCallback((e) => { if (!guardado.current && (sucio || ocupado.current)) { e.preventDefault(); e.returnValue = ''; } }, [sucio]));
  useEffect(() => { if (blocker.state !== 'blocked') return; if (ocupado.current) { blocker.reset(); return; } let activo = true; void solicitar.current('¿Salir sin guardar el catálogo?').then((aceptar) => { if (activo) { if (aceptar) blocker.proceed(); else blocker.reset(); } }); return () => { activo = false; }; }, [blocker]);
  useEffect(() => {
    let activo = true; setCargando(true); setError('');
    const cargar = async () => { try {
      const [p, c] = await Promise.all([api.get('/planteles/mios'), api.get('/academico/ciclos')]);
      if (!activo) return; setPlanteles(p.data); setCiclos(c.data);
      if (!nuevo) { const { data } = await api.get(`/academico/catalogos/${tipo}/${id}`); if (!activo) return; const f = { ...vacio, ...data, plantelId: String(data.plantelId) }; setForm(f); setBase(f); }
    } catch (err) { if (activo) setError(mensajeDeError(err)); } finally { if (activo) setCargando(false); } };
    void cargar(); titulo.current?.focus(); return () => { activo = false; };
  }, [tipo, id, nuevo, intento]);
  const guardar = async (e: FormEvent) => {
    e.preventDefault(); if (ocupado.current || cargando) return;
    if (!nuevo && !form.activo && !await confirmacion.solicitar('¿Desactivar este registro? Los grupos e historial existentes se conservan.')) return;
    ocupado.current = true; setGuardando(true); setError('');
    try {
      if (nuevo) await api.post(`/academico/catalogos/${tipo}`, { clave: form.clave, nombre: form.nombre, plantelId: Number(form.plantelId),
        ...(tipo === 'carreras' ? { nivelId: Number(form.nivelId), versionPlan: form.versionPlan } : {}),
        ...(tipo === 'periodos' ? { carreraId: Number(form.carreraId), cicloId: Number(form.cicloId), tipo: form.tipo, numero: Number(form.numero), ...(form.fechaInicio ? {fechaInicio:form.fechaInicio,fechaFin:form.fechaFin} : {}) } : {}) });
      else await api.patch(`/academico/catalogos/${tipo}/${id}`, { clave: form.clave, nombre: form.nombre, activo: form.activo, ...(tipo==='periodos' && form.fechaInicio ? {fechaInicio:form.fechaInicio,fechaFin:form.fechaFin} : {}) });
      guardado.current = true; navigate(`/catalogos-academicos?tipo=${tipo}`, { replace: true, state: { mensaje: 'Catálogo guardado.' } });
    } catch (err) { setError(mensajeDeError(err)); } finally { ocupado.current = false; setGuardando(false); }
  };
  return <main className="contenido edicion-enfocada">{confirmacion.elemento}<h1 ref={titulo} tabIndex={-1}>{nuevo ? 'Registrar' : 'Editar'} · {etiquetas[tipo]}</h1>
    <button disabled={guardando} onClick={() => navigate(`/catalogos-academicos?tipo=${tipo}`)}>Cancelar y volver</button>
    {cargando && <p role="status">Cargando…</p>}{error && <p role="alert">{error}</p>}{!cargando && error && <button disabled={guardando || sucio} onClick={() => setIntento((n) => n + 1)}>Reintentar carga</button>}
    {!cargando && <form className="panel" onSubmit={guardar}><fieldset disabled={guardando}><legend>Identificación del catálogo</legend>
      <label htmlFor="cat-clave">Clave</label><input id="cat-clave" required maxLength={20} value={form.clave} onChange={(e) => setForm({ ...form, clave: e.target.value })} />
      <label htmlFor="cat-nombre">Nombre</label><input id="cat-nombre" required maxLength={120} value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
      {nuevo ? <><label htmlFor="cat-plantel">Plantel</label><select id="cat-plantel" required value={form.plantelId} onChange={(e) => setForm({ ...form, plantelId: e.target.value, nivelId: '', carreraId: '' })}><option value="">Selecciona…</option>{planteles.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}</select>
        {tipo !== 'niveles' && form.plantelId && <SelectorBuscable<{ id: number; nombre: string }> ruta="/academico/catalogos/niveles" etiqueta="Nivel" valor={form.nivelId} filtros={{ plantelId: form.plantelId }} cambiar={(nivelId) => setForm({ ...form, nivelId, carreraId: '' })} texto={(n) => n.nombre} />}
        {tipo === 'carreras' && <><label htmlFor="cat-plan">Versión del plan</label><input id="cat-plan" required maxLength={40} value={form.versionPlan} onChange={(e) => setForm({ ...form, versionPlan: e.target.value })} /></>}
        {tipo === 'periodos' && <>
          {form.nivelId && <SelectorBuscable<{ id: number; nombre: string; versionPlan: string }> ruta="/academico/catalogos/carreras" etiqueta="Carrera/plan" valor={form.carreraId} filtros={{ plantelId: form.plantelId, nivelId: form.nivelId }} cambiar={(carreraId) => setForm({ ...form, carreraId })} texto={(c) => `${c.nombre} · ${c.versionPlan}`} />}
          <label htmlFor="cat-ciclo">Ciclo</label><select id="cat-ciclo" required value={form.cicloId} onChange={(e) => setForm({ ...form, cicloId: e.target.value })}><option value="">Selecciona…</option>{ciclos.map((c) => <option key={c.id} value={c.id}>{c.clave}</option>)}</select>
          <label htmlFor="cat-tipo">Modalidad del periodo</label><select id="cat-tipo" value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}><option value="ANUAL">Año</option><option value="SEMESTRAL">Semestre</option><option value="CUATRIMESTRAL">Cuatrimestre</option></select>
          <label htmlFor="cat-numero">Número de periodo</label><input id="cat-numero" type="number" required min={1} max={1000} value={form.numero} onChange={(e) => setForm({ ...form, numero: e.target.value })} />
        </>}
      </> : <><p>El plantel y las relaciones del catálogo son inmutables. Crea otro registro para otro contexto.</p><label><input type="checkbox" checked={form.activo} onChange={(e) => setForm({ ...form, activo: e.target.checked })} />Activo</label></>}
      {tipo==='periodos' && <><label htmlFor="cat-fecha-inicio">Inicio real del periodo (necesario para reinscripción dentro del ciclo)</label><input type="date" id="cat-fecha-inicio" value={form.fechaInicio??''} onChange={e=>setForm({...form,fechaInicio:e.target.value})}/><label htmlFor="cat-fecha-fin">Fin real del periodo</label><input type="date" id="cat-fecha-fin" required={!!form.fechaInicio} value={form.fechaFin??''} onChange={e=>setForm({...form,fechaFin:e.target.value})}/></>}
      <button className="boton" disabled={guardando || (nuevo && tipo !== 'niveles' && !form.nivelId) || (nuevo && tipo === 'periodos' && !form.carreraId)}>{guardando ? 'Guardando…' : 'Guardar catálogo'}</button>
    </fieldset></form>}
  </main>;
}
