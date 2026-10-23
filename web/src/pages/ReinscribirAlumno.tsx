import { FormEvent, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, mensajeDeError } from '../api/client';
import { CONTEXTO_VACIO, ContextoAcademicoSelector } from '../components/ContextoAcademicoSelector';
import { SelectorBuscable } from '../components/SelectorBuscable';
import { useAuth } from '../auth/AuthContext';
import { pesos } from '../utils/formato';

interface Alumno { id: number; matricula: string; usuario: { nombre: string; apellidoPaterno: string; apellidoMaterno: string | null } }
interface Trayectoria {
  alumno: { id: number; matricula: string; nombre: string; plantelId: number };
  origen: { inscripcionId: number; grupo: string; cicloId: number; nivelId: number; carreraId: number;
    periodoAcademicoId: number; periodo: string; tipo: string; numero: number; turno: 'MATUTINO' | 'VESPERTINO'; fechaFin: string };
  advertencia: string;
}
interface Ciclo { id: number; nombre: string; clave: string; estado: string; fechaInicio: string; fechaFin: string }
interface Concepto { id: number; nombre: string; tipo: string; montoBase: number; activo: boolean }
interface Cotizacion { cotizacion: string; total: number; conceptos: { conceptoId: number; nombre: string; monto: number }[] }
interface Resultado { id: number; estado: string; solicitudId: number; grupoId: number | null; conceptos: { nombre: string; monto: number }[] }

export default function ReinscribirAlumnoPage() {
  const navigate = useNavigate();
  const { tieneRol } = useAuth();
  const puedeAjustar = tieneRol('FINANZAS', 'SUPERADMIN');
  const [planteles, setPlanteles] = useState<{ id: number; nombre: string }[]>([]);
  const [ciclos, setCiclos] = useState<Ciclo[]>([]);
  const [conceptos, setConceptos] = useState<Concepto[]>([]);
  const [cargando, setCargando] = useState(true), [ocupado, setOcupado] = useState(false), [error, setError] = useState('');
  const [plantel, setPlantel] = useState(''), [alumnoId, setAlumnoId] = useState('');
  const [trayectoria, setTrayectoria] = useState<Trayectoria | null>(null);
  const [cicloId, setCicloId] = useState(''), [contexto, setContexto] = useState(CONTEXTO_VACIO);
  const [turno, setTurno] = useState<'MATUTINO' | 'VESPERTINO'>('MATUTINO'), [grupoId, setGrupoId] = useState('');
  const [conceptoIds, setConceptoIds] = useState<number[]>([]);
  const [periodo, setPeriodo] = useState(''), [vencimiento, setVencimiento] = useState(''), [motivo, setMotivo] = useState('');
  const [monto, setMonto] = useState(''), [motivoAjuste, setMotivoAjuste] = useState('');
  const [cotizacion, setCotizacion] = useState<(Cotizacion & { firma: string }) | null>(null);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const intento = useRef(crypto.randomUUID());

  useEffect(() => {
    let activa = true;
    setCargando(true);
    Promise.all([
      api.get<{ id: number; nombre: string }[]>('/planteles/mios'),
      api.get<Ciclo[]>('/academico/ciclos'),
      api.get<Concepto[]>('/finanzas/conceptos'),
    ]).then(([p,c,k]) => {
      if (activa) { setPlanteles(p.data); setCiclos(c.data); setConceptos(k.data); }
    }).catch(e => { if (activa) setError(mensajeDeError(e)); })
      .finally(() => { if (activa) setCargando(false); });
    return () => { activa = false; };
  }, []);

  useEffect(() => {
    if (!alumnoId) { setTrayectoria(null); return; }
    let activa = true;
    setTrayectoria(null); setCotizacion(null); setError('');
    api.get<Trayectoria>(`/cartera/reinscripciones/alumnos/${alumnoId}`)
      .then(({data}) => {
        if (!activa) return;
        setTrayectoria(data);
        setPlantel(String(data.alumno.plantelId));
        setTurno(data.origen.turno);
        setContexto({ nivelId: String(data.origen.nivelId), carreraId: String(data.origen.carreraId), periodoAcademicoId: '' });
      })
      .catch(e => { if (activa) setError(mensajeDeError(e)); });
    return () => { activa = false; };
  }, [alumnoId]);

  const ajuste = conceptos.find(c => c.tipo === 'COLEGIATURA' && conceptoIds.includes(c.id));
  const cambios = ajuste && monto !== '' && Number(monto) !== ajuste.montoBase
    ? [{ conceptoId: ajuste.id, monto: Number(monto), motivo: motivoAjuste }] : [];
  const payload = {
    alumnoId: Number(alumnoId), plantelId: Number(plantel), cicloId: Number(cicloId),
    nivelId: Number(contexto.nivelId), carreraId: Number(contexto.carreraId), periodoAcademicoId: Number(contexto.periodoAcademicoId),
    turno, ...(grupoId ? { grupoId: Number(grupoId) } : {}),
    conceptoIds, periodo, fechaVencimiento: vencimiento, origenInscripcionId: trayectoria?.origen.inscripcionId ?? 0,
    ...(motivo.trim() ? { motivo: motivo.trim() } : {}), ...(cambios.length ? { ajustes: cambios } : {}),
  };
  const firma = JSON.stringify(payload);
  const cotizacionValida = cotizacion?.firma === firma;
  const previsualizar = async (e: FormEvent) => {
    e.preventDefault(); if (ocupado) return;
    setOcupado(true); setError(''); setCotizacion(null);
    try {
      const {data} = await api.post<Cotizacion>('/cartera/reinscripciones/previsualizar', payload);
      intento.current = crypto.randomUUID();
      setCotizacion({...data, firma});
    } catch (e) { setError(mensajeDeError(e)); } finally { setOcupado(false); }
  };
  const confirmar = async () => {
    if (ocupado || !cotizacionValida || !cotizacion) return;
    setOcupado(true); setError('');
    try {
      const {data} = await api.post<Resultado>('/cartera/reinscripciones/confirmar',
        {...payload, cotizacion: cotizacion.cotizacion, idempotencia: intento.current, confirmado: true});
      setResultado(data);
    } catch (e) { setError(mensajeDeError(e)); } finally { setOcupado(false); }
  };
  const cicloElegido = ciclos.find(c => String(c.id) === cicloId);
  const destinoValido = trayectoria && cicloElegido && cicloElegido.fechaInicio > trayectoria.origen.fechaFin;
  return <main className="contenido edicion-enfocada">
    <h1>Reinscribir alumno</h1>
    <p>Usa su expediente existente para iniciar el siguiente año, semestre o cuatrimestre según su plan. No se modifica su historial anterior.</p>
    <button type="button" disabled={ocupado} onClick={() => navigate(-1)}>Volver</button>
    {cargando && <p role="status">Cargando opciones…</p>}
    {error && <p role="alert">{error}</p>}
    {resultado ? <section className="cartera-resultado" role="status">
      <h2>{resultado.estado === 'ABIERTA' ? 'Reinscripción registrada' : 'Solicitud de grupo pendiente'}</h2>
      <p>Operación #{resultado.id}. {resultado.grupoId ? `Grupo asignado #${resultado.grupoId}` : 'Aún no se ha asignado un grupo; los cargos esperan esa asignación.'}</p>
      <p>Total del nuevo periodo: {pesos(resultado.conceptos.reduce((a,c)=>a+c.monto,0))}</p>
      <Link to={puedeAjustar ? '/finanzas?vista=cargos' : '/apertura-cartera?vista=consulta'}>Consultar movimientos</Link>
    </section> : !cargando && <form className="panel" onSubmit={previsualizar}>
      <fieldset disabled={ocupado}>
        <legend>1. Alumno y periodo actual</legend>
        <label htmlFor="reinscripcion-plantel">Plantel</label>
        <select id="reinscripcion-plantel" required value={plantel} onChange={e => { setPlantel(e.target.value); setAlumnoId(''); setTrayectoria(null); setCotizacion(null); }}>
          <option value="">Selecciona…</option>{planteles.map(p=><option key={p.id} value={p.id}>{p.nombre}</option>)}
        </select>
        {plantel && <SelectorBuscable<Alumno> ruta="/alumnos" filtros={{ plantelId: plantel }} valor={alumnoId}
          cambiar={setAlumnoId} etiqueta="Alumno (matrícula o nombre completo)"
          texto={a=>`${a.matricula} — ${a.usuario.nombre} ${a.usuario.apellidoPaterno} ${a.usuario.apellidoMaterno ?? ''}`.trim()} />}
        {trayectoria && <section className="cartera-aviso" aria-label="Historial académico previo">
          <h2>Periodo de origen</h2>
          <p>{trayectoria.alumno.nombre} · {trayectoria.alumno.matricula}</p>
          <p>{trayectoria.origen.periodo} · {trayectoria.origen.tipo} {trayectoria.origen.numero} · Grupo {trayectoria.origen.grupo}</p>
          <p>{trayectoria.advertencia}</p>
        </section>}
      </fieldset>
      {trayectoria && <fieldset disabled={ocupado}>
        <legend>2. Nuevo periodo académico</legend>
        <label htmlFor="reinscripcion-ciclo">Ciclo de destino</label>
        <select id="reinscripcion-ciclo" required value={cicloId} onChange={e=>{setCicloId(e.target.value);setContexto({...contexto,periodoAcademicoId:''});setGrupoId('');}}>
          <option value="">Selecciona ciclo posterior…</option>
          {ciclos.filter(c=>c.estado === 'PREPARACION' && c.fechaInicio > trayectoria.origen.fechaFin).map(c=><option key={c.id} value={c.id}>{c.nombre || c.clave}</option>)}
        </select>
        {!destinoValido && <p className="texto-ayuda">Para avanzar dentro del mismo ciclo se requiere la migración de inscripciones por periodo. Este formulario evita duplicarlas.</p>}
        <ContextoAcademicoSelector plantelId={plantel} cicloId={cicloId} valor={contexto}
          cambiar={v=>{setContexto(v);setGrupoId('');}} deshabilitado={!destinoValido}/>
        <label htmlFor="reinscripcion-turno">Turno</label>
        <select id="reinscripcion-turno" value={turno} onChange={e=>{setTurno(e.target.value as 'MATUTINO'|'VESPERTINO');setGrupoId('');}}>
          <option value="MATUTINO">Matutino</option><option value="VESPERTINO">Vespertino</option>
        </select>
        {contexto.periodoAcademicoId && <SelectorBuscable<{id:number;nombre:string}> ruta="/academico/grupos" etiqueta="Grupo destino (opcional)"
          valor={grupoId} cambiar={setGrupoId} requerido={false}
          filtros={{plantelId:plantel,cicloId,...contexto,turno}} texto={g=>g.nombre}/>}
        <label htmlFor="reinscripcion-motivo">Motivo del movimiento (requerido en repetición, retroceso o salto)</label>
        <textarea id="reinscripcion-motivo" maxLength={500} value={motivo} onChange={e=>setMotivo(e.target.value)} rows={3}
          placeholder="Describir la razón académica o administrativa si no es un avance ordinario"/>
      </fieldset>}
      {trayectoria && <fieldset disabled={ocupado}>
        <legend>3. Cotización y cargos del nuevo periodo</legend>
        <p>Los importes previos se conservan; las tarifas autorizadas aquí se aplican solo a nuevos cargos. Control Escolar no puede ajustar importes.</p>
        {conceptos.filter(c=>c.activo && c.montoBase>0 && !['BECA','DESCUENTO','RECARGO'].includes(c.tipo)).map(c=>
          <label key={c.id}><input type="checkbox" checked={conceptoIds.includes(c.id)}
            onChange={e=>{setConceptoIds(ids=>e.target.checked?[...ids,c.id]:ids.filter(id=>id!==c.id));if(c.tipo==='COLEGIATURA'){setMonto('');setMotivoAjuste('');}}}/>
            {c.nombre} — {pesos(c.montoBase)}
          </label>)}
        {ajuste && puedeAjustar && <>
          <label htmlFor="reinscripcion-monto">Importe de colegiatura autorizado para nuevo periodo</label>
          <input id="reinscripcion-monto" type="number" min="0.01" step="0.01" value={monto || String(ajuste.montoBase)} onChange={e=>setMonto(e.target.value)}/>
          {cambios.length>0 && <>
            <label htmlFor="reinscripcion-ajuste-motivo">Justificación del cambio de tarifa</label>
            <textarea id="reinscripcion-ajuste-motivo" required minLength={10} maxLength={250} value={motivoAjuste} onChange={e=>setMotivoAjuste(e.target.value)} />
          </>}
        </>}
        <label htmlFor="reinscripcion-periodo">Mes de cobro</label><input type="month" id="reinscripcion-periodo" required value={periodo} onChange={e=>setPeriodo(e.target.value)}/>
        <label htmlFor="reinscripcion-vencimiento">Fecha de vencimiento</label><input type="date" id="reinscripcion-vencimiento" required value={vencimiento} onChange={e=>setVencimiento(e.target.value)}/>
      </fieldset>}
      {trayectoria && <div className="cartera-resumen">
        <button className="boton" type="submit" disabled={!destinoValido||!contexto.periodoAcademicoId||!conceptoIds.length||ocupado}>Previsualizar reinscripción</button>
        {cotizacionValida && cotizacion && <div aria-live="polite"><h2>Confirmar nuevo periodo</h2>
          <p>{trayectoria.origen.periodo} → periodo seleccionado · {cicloElegido?.nombre || cicloElegido?.clave}</p>
          {cotizacion.conceptos.map(c=><p key={c.conceptoId}>{c.nombre}: {pesos(c.monto)}</p>)}
          <p><strong>Total: {pesos(cotizacion.total)}</strong></p>
          <p>Confirmar crea una nueva solicitud y cargos solo si corresponde; no implica aprobación de materias reprobadas ni pago registrado.</p>
          <button className="boton" type="button" disabled={ocupado} onClick={()=>void confirmar()}>{ocupado?'Confirmando…':'Confirmar reinscripción y cargos'}</button>
        </div>}
      </div>}
    </form>}
  </main>;
}
