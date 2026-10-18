import { FormEvent, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { api, mensajeDeError } from '../api/client';
import { ContextoAcademicoSelector, CONTEXTO_VACIO } from '../components/ContextoAcademicoSelector';
import { SelectorBuscable } from '../components/SelectorBuscable';
import { PanelAccionesModulo } from '../components/PanelAccionesModulo';
import { Paginador } from '../components/Paginador';
import { useSalidaPendiente } from '../components/useSalidaPendiente';
interface Concepto { id: number; clave: string; nombre: string; montoBase: number; tipo: string; activo: boolean }
interface Cotizacion { cotizacion: string; total: number; conceptos: { conceptoId: number; nombre: string; monto: number }[] }
interface Apertura { id: number; alumnoId: number; estado: string; grupoId: number | null; conceptos: { nombre: string; monto: number; cargoId?: number }[] }
const inicial = { alumnoId: '', plantelId: '', cicloId: '', turno: 'MATUTINO', grupoId: '', periodo: '', fechaVencimiento: '' };
export default function AperturaCarteraPage() {
  return useLocation().pathname.endsWith('/nueva') ? <Formulario /> : <Directorio />;
}
function Directorio() {
  const [q,setQ] = useSearchParams(), consulta = q.get('vista') === 'consulta', pagina = Number(q.get('pagina')) || 1;
  const [buscar,setBuscar] = useState(q.get('buscar') || ''), [datos,setDatos] = useState<Apertura[]>([]), [total,setTotal] = useState(0), [error,setError] = useState(''), [cargando,setCargando] = useState(false), [intento,setIntento] = useState(0);
  const navigate = useNavigate();
  useEffect(() => { if (!consulta) return; let vigente=true; setCargando(true); setError('');
    api.get('/cartera', { params: { pagina, porPagina: 10, buscar: q.get('buscar') || '' } }).then(r => { if(vigente){setDatos(r.data.datos);setTotal(r.data.total);} }).catch(e => {if(vigente)setError(mensajeDeError(e));}).finally(()=>{if(vigente)setCargando(false);});
    return ()=>{vigente=false;};
  },[consulta,pagina,q,intento]);
  return <><h1>Apertura de cartera</h1><p>Inscripción ordinaria y cargos con tarifas autorizadas por Finanzas.</p>{!consulta ? <PanelAccionesModulo titulo="Gestionar aperturas" acciones={[
    { titulo: 'Abrir cartera ordinaria', detalle: 'Seleccionar alumno, contexto y conceptos; previsualizar antes de confirmar', ejecutar: ()=>navigate('/apertura-cartera/nueva') },
    { titulo: 'Consultar aperturas', detalle: 'Revisar asignaciones y solicitudes pendientes', ejecutar: ()=>setQ({vista:'consulta'}) },
  ]}/> : <><Link to="/apertura-cartera/nueva">Nueva apertura</Link><button onClick={()=>setQ({})}>Volver a opciones</button>
    <form onSubmit={e=>{e.preventDefault();setQ({vista:'consulta',buscar});}}><label htmlFor="buscar-cartera">Buscar por nombre o matrícula</label><input id="buscar-cartera" value={buscar} onChange={e=>setBuscar(e.target.value)}/><button>Buscar</button></form>
    {cargando&&<p role="status">Cargando…</p>}{error&&<p role="alert">{error}<button onClick={()=>setIntento(v=>v+1)}>Reintentar</button></p>}
    <div className="tabla-contenedor"><table className="tabla"><thead><tr><th>Apertura / alumno</th><th>Estado</th><th>Grupo</th><th>Conceptos confirmados</th></tr></thead><tbody>{datos.map(a=><tr key={a.id}><td>#{a.id} · Alumno {a.alumnoId}</td><td>{a.estado}</td><td>{a.grupoId || 'Pendiente de cohorte compatible'}</td><td>{a.conceptos.map(c=><p key={c.nombre}>{c.nombre}: ${c.monto.toFixed(2)} · {c.cargoId ? `Cargo ${c.cargoId}` : 'Sin cargo generado'}</p>)}</td></tr>)}{!cargando&&!datos.length&&<tr><td colSpan={4}>Sin aperturas para esta consulta.</td></tr>}</tbody></table></div>
    <Paginador total={total} pagina={pagina} porPagina={10} deshabilitado={cargando} onCambio={p=>setQ({vista:'consulta',buscar:q.get('buscar')||'',pagina:String(p)})}/>
  </>}</>;
}
function Formulario() {
  const navigate=useNavigate(), [f,setF]=useState(inicial), [contexto,setContexto]=useState(CONTEXTO_VACIO), [conceptoIds,setConceptoIds]=useState<number[]>([]);
  const [planteles,setPlanteles]=useState<{id:number;nombre:string}[]>([]), [ciclos,setCiclos]=useState<{id:number;clave:string;nombre?:string;fechaInicio?:string;fechaFin?:string;estado:string}[]>([]), [conceptos,setConceptos]=useState<Concepto[]>([]);
  const [cargando,setCargando]=useState(true), [intento,setIntento]=useState(0), [error,setError]=useState(''), [ocupada,setOcupada]=useState(false), [cotizacion,setCotizacion]=useState<(Cotizacion&{clave:string})|null>(null), [resultado,setResultado]=useState<Apertura|null>(null);
  const ocupado=useRef(false), guardado=useRef(false), idempotencia=useRef(crypto.randomUUID()), titulo=useRef<HTMLHeadingElement>(null);
  const salida=useSalidaPendiente(JSON.stringify(f)!==JSON.stringify(inicial)||conceptoIds.length>0,ocupado,guardado);
  useEffect(()=>{titulo.current?.focus();},[]);
  useEffect(()=>{let vigente=true;setCargando(true);setError('');Promise.all([api.get('/planteles/mios'),api.get('/academico/ciclos'),api.get('/finanzas/conceptos')]).then(([p,c,k])=>{if(vigente){setPlanteles(p.data);setCiclos(c.data);setConceptos(k.data);}}).catch(e=>{if(vigente)setError(mensajeDeError(e));}).finally(()=>{if(vigente)setCargando(false);});return()=>{vigente=false;};},[intento]);
  const payload={alumnoId:Number(f.alumnoId),plantelId:Number(f.plantelId),cicloId:Number(f.cicloId),nivelId:Number(contexto.nivelId),carreraId:Number(contexto.carreraId),periodoAcademicoId:Number(contexto.periodoAcademicoId),turno:f.turno,...(f.grupoId?{grupoId:Number(f.grupoId)}:{}),conceptoIds,periodo:f.periodo,fechaVencimiento:f.fechaVencimiento};
  const cicloSeleccionado=ciclos.find(c=>String(c.id)===f.cicloId);
  const clave=JSON.stringify(payload), vigente=cotizacion?.clave===clave;
  const previsualizar=async(e:FormEvent)=>{e.preventDefault();if(ocupado.current)return;ocupado.current=true;setOcupada(true);setError('');try{const r=await api.post<Cotizacion>('/cartera/previsualizar',payload);idempotencia.current=crypto.randomUUID();setCotizacion({...r.data,clave});}catch(e){setError(mensajeDeError(e));setCotizacion(null);}finally{ocupado.current=false;setOcupada(false);}};
  const confirmar=async()=>{if(ocupado.current||!vigente||!cotizacion)return;ocupado.current=true;setOcupada(true);setError('');try{const r=await api.post<Apertura>('/cartera/confirmar',{...payload,cotizacion:cotizacion.cotizacion,idempotencia:idempotencia.current,confirmado:true});guardado.current=true;setResultado(r.data);}catch(e){setError(mensajeDeError(e));}finally{ocupado.current=false;setOcupada(false);}};
  return <main className="contenido edicion-enfocada">{salida}<h1 ref={titulo} tabIndex={-1}>Abrir cartera ordinaria</h1><button disabled={ocupada} onClick={()=>navigate('/apertura-cartera?vista=consulta')}>Volver a aperturas</button>
    {cargando&&<p role="status">Cargando opciones…</p>}{error&&<p role="alert">{error}</p>}{!cargando&&(!planteles.length||!ciclos.length||!conceptos.length)&&<p>No hay opciones suficientes. Revisa catálogos y tarifas con los responsables.<button onClick={()=>setIntento(v=>v+1)}>Reintentar</button></p>}
    {resultado?<section role="status"><h2>{resultado.estado==='ABIERTA'?'Cartera abierta':'Solicitud pendiente de agrupación'}</h2><p>Apertura #{resultado.id}. {resultado.grupoId?`Grupo ${resultado.grupoId}`:'No se crean cargos hasta contar con grupo compatible; con 1–4 alumnos sin destino se conserva la solicitud.'}</p><Link to="/apertura-cartera?vista=consulta">Consultar aperturas</Link></section>:!cargando&&<form className="panel" onSubmit={previsualizar}><fieldset disabled={ocupada}><legend>Alumno y contexto ordinario</legend>
      <label htmlFor="cartera-plantel">Plantel</label><select id="cartera-plantel" required value={f.plantelId} onChange={e=>{setF({...f,plantelId:e.target.value,alumnoId:'',grupoId:''});setContexto(CONTEXTO_VACIO);}}><option value="">Selecciona…</option>{planteles.map(p=><option key={p.id} value={p.id}>{p.nombre}</option>)}</select>
      {f.plantelId&&<SelectorBuscable<{id:number;matricula:string;usuario:{nombre:string;apellidoPaterno:string}}> ruta="/alumnos" etiqueta="Alumno existente" valor={f.alumnoId} filtros={{plantelId:f.plantelId}} cambiar={alumnoId=>setF({...f,alumnoId})} texto={a=>`${a.matricula} · ${a.usuario.nombre} ${a.usuario.apellidoPaterno}`}/>}
      <label htmlFor="cartera-ciclo">Ciclo</label><select id="cartera-ciclo" required value={f.cicloId} onChange={e=>{setF({...f,cicloId:e.target.value,grupoId:''});setContexto(CONTEXTO_VACIO);}}><option value="">Selecciona…</option>{ciclos.filter(c=>['ACTIVO','PREPARACION'].includes(c.estado)).map(c=><option key={c.id} value={c.id}>{c.clave}</option>)}</select>
       {cicloSeleccionado&&<p className="texto-ayuda" aria-label="Vigencia del ciclo"><strong>Vigencia del ciclo:</strong> {cicloSeleccionado.nombre||cicloSeleccionado.clave} · {cicloSeleccionado.fechaInicio||"Fecha inicial no disponible"} — {cicloSeleccionado.fechaFin||"Fecha final no disponible"}. El mes de cobro se configura por separado.</p>}
      <ContextoAcademicoSelector plantelId={f.plantelId} cicloId={f.cicloId} valor={contexto} cambiar={c=>{setContexto(c);setF({...f,grupoId:''});}}/>
      <label htmlFor="cartera-turno">Turno</label><select id="cartera-turno" value={f.turno} onChange={e=>setF({...f,turno:e.target.value,grupoId:''})}><option value="MATUTINO">Matutino</option><option value="VESPERTINO">Vespertino</option></select>
      {contexto.periodoAcademicoId&&<SelectorBuscable<{id:number;nombre:string}> ruta="/academico/grupos" etiqueta="Grupo regular compatible (opcional)" requerido={false} valor={f.grupoId} cambiar={grupoId=>setF({...f,grupoId})} filtros={{plantelId:f.plantelId,cicloId:f.cicloId,...contexto,turno:f.turno}} texto={g=>g.nombre}/>}
      <p>Sin grupo seleccionado se solicita planificación automática. No se trasladan alumnos con historial ni se incluyen programas especiales.</p>
      <label htmlFor="cartera-periodo">Mes de cobro</label><input id="cartera-periodo" type="month" required value={f.periodo} onChange={e=>setF({...f,periodo:e.target.value})}/>
      <label htmlFor="cartera-vencimiento">Fecha de vencimiento</label><input id="cartera-vencimiento" type="date" required value={f.fechaVencimiento} onChange={e=>setF({...f,fechaVencimiento:e.target.value})}/>
      <fieldset><legend>Conceptos con tarifa de Finanzas</legend>{conceptos.filter(c=>c.activo&&!['BECA','DESCUENTO','RECARGO'].includes(c.tipo)&&c.montoBase>0).map(c=><label key={c.id}><input type="checkbox" checked={conceptoIds.includes(c.id)} onChange={e=>setConceptoIds(e.target.checked?[...conceptoIds,c.id]:conceptoIds.filter(id=>id!==c.id))}/>{c.clave} · {c.nombre} · ${Number(c.montoBase).toFixed(2)}</label>)}</fieldset>
      <button className="boton" disabled={ocupada||!conceptoIds.length}>Previsualizar apertura</button>
      {cotizacion&&vigente&&<section aria-label="Previsualización"><h2>Confirmar apertura</h2><p><strong>Ciclo:</strong> {cicloSeleccionado?.nombre||cicloSeleccionado?.clave||f.cicloId} · <strong>Mes de cobro:</strong> {f.periodo} · <strong>Vencimiento:</strong> {f.fechaVencimiento}</p>{cotizacion.conceptos.map(c=><p key={c.conceptoId}>{c.nombre}: ${c.monto.toFixed(2)}</p>)}<p>Total autorizado: ${cotizacion.total.toFixed(2)}. Si queda pendiente, se conservan estos precios y no se generan cargos hasta asignar grupo.</p><button type="button" className="boton" disabled={ocupada} onClick={()=>void confirmar()}>{ocupada?'Confirmando…':'Confirmar inscripción y cargos'}</button></section>}
    </fieldset></form>}
  </main>;
}
