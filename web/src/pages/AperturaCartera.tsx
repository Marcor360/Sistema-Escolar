import AperturaIntegral from './AperturaIntegral';
import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { api, mensajeDeError } from '../api/client';
import { PanelAccionesModulo } from '../components/PanelAccionesModulo';
import { Paginador } from '../components/Paginador';
import { estadoApertura, montoMXN } from './cartera-presentacion';
import './cartera.css';
interface Apertura { id: number; alumnoId: number; matricula?: string; nombreAlumno?: string; total?: number; estado: string; grupoId: number | null; conceptos: { nombre: string; monto: number; cargoId?: number }[] }
export default function AperturaCarteraPage() {
  return useLocation().pathname.endsWith('/nueva') ? <AperturaIntegral /> : <Directorio />;
}
function Directorio() {
  const [q,setQ] = useSearchParams(), consulta = q.get('vista') === 'consulta', pagina = Number(q.get('pagina')) || 1;
  const [buscar,setBuscar] = useState(q.get('buscar') || ''), [datos,setDatos] = useState<Apertura[]>([]), [total,setTotal] = useState(0), [error,setError] = useState(''), [cargando,setCargando] = useState(false), [intento,setIntento] = useState(0);
  const navigate = useNavigate();
  useEffect(() => { if (!consulta) return; let vigente=true; setCargando(true); setError('');
    api.get('/cartera', { params: { pagina, porPagina: 10, buscar: q.get('buscar') || '', ...(q.get('estado') ? { estado: q.get('estado') } : {}), ...(q.get('plantelId') ? { plantelId: q.get('plantelId') } : {}) } }).then(r => { if(vigente){setDatos(r.data.datos);setTotal(r.data.total);} }).catch(e => {if(vigente)setError(mensajeDeError(e));}).finally(()=>{if(vigente)setCargando(false);});
    return ()=>{vigente=false;};
  },[consulta,pagina,q,intento]);
  return <><h1>Apertura de cartera</h1><p>Inscripción ordinaria y cargos con tarifas autorizadas por Finanzas.</p>{!consulta ? <PanelAccionesModulo titulo="Gestionar aperturas" acciones={[
    { titulo: 'Crear alumno y cartera', detalle: 'Registrar expediente sin correo institucional y preparar total y cuotas', ejecutar: ()=>navigate('/apertura-cartera/nueva') },
    { titulo: 'Asignar cartera a alumno existente', detalle: 'Seleccionar un alumno que todavía no tiene cartera', ejecutar: ()=>navigate('/apertura-cartera/nueva?modo=existente') },
    { titulo: 'Reinscribir alumno', detalle: 'Buscar expediente existente y preparar siguiente ciclo sin duplicar matrícula', ejecutar: ()=>navigate('/apertura-cartera/reinscribir') },
    { titulo: 'Consultar aperturas', detalle: 'Revisar asignaciones y solicitudes pendientes', ejecutar: ()=>setQ({vista:'consulta'}) },
  ]}/> : <><Link to="/apertura-cartera/nueva">Nueva apertura</Link><button onClick={()=>setQ({})}>Volver a opciones</button>
    <form onSubmit={e=>{e.preventDefault();setQ(prev => { const next = new URLSearchParams(prev); next.set('vista','consulta'); next.set('buscar',buscar); next.delete('pagina'); return next; });}}><label htmlFor="buscar-cartera">Buscar por nombre o matrícula</label><input id="buscar-cartera" value={buscar} onChange={e=>setBuscar(e.target.value)}/><button>Buscar</button></form>
    {cargando&&<p role="status">Cargando…</p>}{error&&<p role="alert">{error}<button onClick={()=>setIntento(v=>v+1)}>Reintentar</button></p>}
    {q.get('estado') === 'PAUSA' && <p role="status">Mostrando carteras en pausa. <button onClick={() => setQ(prev => { const next = new URLSearchParams(prev); next.delete('estado'); next.delete('pagina'); return next; })}>Mostrar todos los estados</button></p>}
    {q.get('plantelId') && <p>Filtro de plantel #{q.get('plantelId')}. <button onClick={() => setQ(prev => { const next = new URLSearchParams(prev); next.delete('plantelId'); next.delete('pagina'); return next; })}>Ver todos mis planteles</button></p>}
    <p className="texto-ayuda">Estados: Abierta y asignada · Pausa / baja temporal sin cobros · Pendiente de grupo · Requiere revisión. Solo se generan cargos después de asignar un grupo.</p>
    <div className="tabla-contenedor"><table className="tabla tabla-adaptable"><caption className="sr-only">Aperturas de cartera consultadas</caption><thead><tr><th scope="col">Apertura / alumno</th><th scope="col">Estado</th><th scope="col">Grupo</th><th scope="col">Conceptos y cargos</th></tr></thead><tbody>{datos.map(a=><tr key={a.id}>
      <td data-etiqueta="Apertura / alumno"><strong>#{a.id}</strong><span>{a.nombreAlumno || `Alumno ${a.alumnoId}`}{a.matricula ? ` · ${a.matricula}` : ''}</span></td>
      <td data-etiqueta="Estado"><strong>{estadoApertura(a.estado).titulo}</strong><span className="texto-ayuda">{estadoApertura(a.estado).descripcion}</span></td>
      <td data-etiqueta="Grupo">{a.grupoId ? `Grupo ${a.grupoId}` : 'Sin grupo asignado'}</td>
      <td data-etiqueta="Conceptos y cargos"><p>{a.conceptos.length} cuotas · Total contratado: <strong>{montoMXN(a.total ?? a.conceptos.reduce((s,c)=>s+c.monto,0))}</strong></p><Link className="boton secundario" to={`/apertura-cartera/${a.id}?${q.toString()}`}>Ver cuotas y pagos<span className="sr-only"> de apertura #{a.id}</span></Link></td>
    </tr>)}{!cargando&&!datos.length&&<tr><td className="vacio" colSpan={4}>Sin aperturas para esta consulta.</td></tr>}</tbody></table></div>
    <Paginador total={total} pagina={pagina} porPagina={10} deshabilitado={cargando} onCambio={p=>setQ(prev => { const next = new URLSearchParams(prev); next.set('pagina',String(p)); return next; })}/>
  </>}</>;
}
