import { PropuestasFinal, type PropuestaFinal } from '../components/PropuestasFinal';
import { DetallePonderacion } from '../components/DetallePonderacion';
import { PonderacionCalificaciones } from '../components/PonderacionCalificaciones';
import { ActaEscolar } from '../components/ActaEscolar';
import { useModuloTrabajo } from '../components/ModuloTrabajo';
import { ImportarCalificaciones } from '../components/ImportarCalificaciones';
import { FormEvent, useEffect, useRef, useState } from 'react';
import { api, mensajeDeError } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { useConfirmacion } from '../components/useConfirmacion';
import { SelectorBuscable } from '../components/SelectorBuscable';
import { Paginador } from '../components/Paginador';
import { Encabezado } from '../components/Encabezado';
interface Clase { id: number; regimenEvaluacion?: string; grupo: { id: number; nombre: string; ciclo: { nombre: string }; plantel: { nombre: string }; nivel?: {nombre:string} | null; carrera?: {nombre:string;versionPlan:string} | null; periodoAcademico?: {nombre:string;tipo:string;numero:number} | null; turno?:string | null }; materia: { clave: string; nombre: string } }
interface Inscripcion { alumno: { id: number; matricula: string; usuario: { nombre: string; apellidoPaterno: string } } }
interface Registro { alumnoId: number; calificacion: number }
interface EstadoPeriodo { estatus: 'ABIERTO' | 'CERRADO'; inscritos: number; capturados: number; faltantes: number }
interface Cambio { id: number; alumnoId: number; valorAnterior: number | null; valorNuevo: number; usuarioId: number; fecha: string; motivo: string | null; observacionAnterior: string | null; observacionNueva: string | null; escalaAnterior?: number; escalaNueva?: number; detalleCalculo?: string | null }
interface Historial { datos: Cambio[]; total: number; pagina: number; porPagina: number }
const HISTORIAL_VACIO: Historial = { datos: [], total: 0, pagina: 1, porPagina: 10 };
const valida = (v: string, maximo: number, decimales = 6) => new RegExp(`^(?:\\d+|\\d*\\.\\d{1,${decimales}})$`).test(v) && Number(v) >= 0 && Number(v) <= maximo;
export default function CalificacionesPage() {
  const { tieneRol } = useAuth(), confirmacion = useConfirmacion();
  const [claseId,setClaseId] = useState(''), [clase,setClase] = useState<Clase | null>(null), [parcial,setParcial] = useState('1');
  const nuevo = clase?.regimenEvaluacion === 'CUATRO_PARCIALES_10', maximo = nuevo ? 10 : 100;
  const decimales = nuevo && parcial === '0' ? 8 : 6;
  const [propuestas,setPropuestas] = useState<PropuestaFinal[]>([]);
  const [ponderando,setPonderando] = useState(false);
  const [borradorPonderacion,setBorradorPonderacion] = useState(false);
  const [alumnos,setAlumnos] = useState<Inscripcion[]>([]), [valores,setValores] = useState<Record<number,string>>({}), [originales,setOriginales] = useState<Record<number,string>>({});
  const [periodo,setPeriodo] = useState<EstadoPeriodo | null>(null), [historial,setHistorial] = useState<Historial>(HISTORIAL_VACIO);
  const [motivo,setMotivo] = useState(''), [error,setError] = useState(''), [mensaje,setMensaje] = useState('');
  const [cargando,setCargando] = useState(false), [enviando,setEnviando] = useState(false), [descargando,setDescargando] = useState(false), [cargandoHistorial,setCargandoHistorial] = useState(false);
  const trabajo=useModuloTrabajo(cargando || enviando || descargando || ponderando),legado=trabajo.modo==='legado',soloConsulta=!legado && trabajo.modo==='consulta',importando=!legado && trabajo.modo==='importar';
  const [borradorImportacion,setBorradorImportacion]=useState(false);
  const contexto = useRef(0);
  const invalidos = alumnos.filter((i) => valores[i.alumno.id] && !valida(valores[i.alumno.id], maximo, decimales));
  const cambios = alumnos.filter((i) => valores[i.alumno.id] && (originales[i.alumno.id] === undefined || Number(valores[i.alumno.id]) !== Number(originales[i.alumno.id])));
  const corrige = cambios.some((i) => originales[i.alumno.id] !== undefined), ocupado = cargando || enviando || ponderando;
  const confirmarContexto=async()=>!(cambios.length || borradorImportacion || borradorPonderacion) || await confirmacion.solicitar('¿Descartar las calificaciones sin guardar antes de cambiar de clase o parcial?');
  useEffect(()=>{if(soloConsulta || importando){setValores(originales);setMotivo('');}},[soloConsulta,importando,originales]);
  useEffect(()=>{if(!importando)setBorradorImportacion(false);},[importando]);
  const limpiar = () => { setBorradorPonderacion(false); setBorradorImportacion(false);contexto.current++; setAlumnos([]); setPropuestas([]); setValores({}); setOriginales({}); setPeriodo(null); setHistorial(HISTORIAL_VACIO); setMotivo(''); setError(''); setMensaje(''); setCargando(false); setCargandoHistorial(false); };
  const cargarHistorial = async (pagina: number) => {
    const actual = contexto.current; setCargandoHistorial(true);
    try { const { data } = await api.get<Historial>(`/calificaciones/periodos/${claseId}/${parcial}/historial`,{ params: { pagina } }); if (actual === contexto.current) setHistorial(data); }
    catch (err) { if (actual === contexto.current) setError(mensajeDeError(err)); }
    finally { if (actual === contexto.current) setCargandoHistorial(false); }
  };
  const cargarAlumnos = async () => {
    if (!clase || ocupado) return;
    limpiar(); const actual = contexto.current; setCargando(true);
    try {
      const [insc,notas,estado,auditoria,propuestasFinal] = await Promise.all([
        api.get<Inscripcion[]>(`/academico/grupos/${clase.grupo.id}/alumnos`,{params:{incluirHistoricas:'true'}}),
        api.get<Registro[]>(`/calificaciones/grupo-materia/${clase.id}`,{ params: { parcial } }),
        api.get<EstadoPeriodo>(`/calificaciones/periodos/${clase.id}/${parcial}`),
        api.get<Historial>(`/calificaciones/periodos/${clase.id}/${parcial}/historial`),
        nuevo && parcial === '0' ? api.get<PropuestaFinal[]>(`/calificaciones/final/propuestas/${clase.id}`) : Promise.resolve({data:[] as PropuestaFinal[]}),
      ]);
      if (actual !== contexto.current) return;
      const mapa = Object.fromEntries(notas.data.map((n) => [n.alumnoId,String(n.calificacion)]));
      setAlumnos(insc.data); setPropuestas(propuestasFinal.data); setValores(mapa); setOriginales(mapa); setPeriodo(estado.data); setHistorial(auditoria.data);
    } catch (err) { if (actual === contexto.current) setError(mensajeDeError(err)); }
    finally { if (actual === contexto.current) setCargando(false); }
  };
  const guardar = async (e: FormEvent) => {
    e.preventDefault(); if (soloConsulta || importando || ocupado || !periodo || periodo.estatus === 'CERRADO') return;
    setError(''); setMensaje('');
    if (invalidos.length) { setError(`Revisa las calificaciones marcadas: usa de 0 a ${maximo} y hasta ${decimales} decimales.`); document.getElementById(`nota-${invalidos[0].alumno.id}`)?.focus(); return; }
    if (!cambios.length) { setMensaje('No hay cambios que guardar.'); return; }
    if (corrige && !motivo.trim()) { setError('Escribe el motivo para corregir las calificaciones existentes.'); document.getElementById('motivo-calificacion')?.focus(); return; }
    setEnviando(true);
    try {
      const { data } = await api.post<{ capturadas: number; sinCambios: number }>('/calificaciones/captura',{ grupoMateriaId: Number(claseId),...(nuevo ? { escalaMaxima: 10 } : {}),parcial: Number(parcial),motivo: motivo.trim() || undefined,items: cambios.map((i) => ({ alumnoId: i.alumno.id,calificacion: Number(valores[i.alumno.id]) })) });
      const guardados = { ...originales,...Object.fromEntries(cambios.map((i) => [i.alumno.id,valores[i.alumno.id]])) }; setOriginales(guardados); setValores((v) => ({ ...v,...guardados })); setMotivo(''); setMensaje(`${data.capturadas} calificaciones guardadas`);
      trabajo.guardado();
      // Una consulta posterior fallida no convierte una captura confirmada en un error de guardado.
      try { const [{ data: estado },{ data: auditoria }] = await Promise.all([api.get<EstadoPeriodo>(`/calificaciones/periodos/${claseId}/${parcial}`),api.get<Historial>(`/calificaciones/periodos/${claseId}/${parcial}/historial`)]); setPeriodo(estado); setHistorial(auditoria); }
      catch { setError('Las notas se guardaron; no se pudo actualizar el resumen. Vuelve a cargar la lista.'); }
    } catch (err) { setError(mensajeDeError(err)); } finally { setEnviando(false); }
  };
  const cambiarEstado = async () => {
    if (!periodo || ocupado) return;
    if (cambios.length) { setError('Guarda los cambios antes de cerrar el periodo.'); return; }
    setEnviando(true); setError(''); setMensaje('');
    const siguiente = periodo.estatus === 'ABIERTO' ? 'CERRADO' : 'ABIERTO';
    try {
      const { data: resumen } = await api.get<EstadoPeriodo>(`/calificaciones/periodos/${claseId}/${parcial}`);
      if (siguiente === 'CERRADO' && resumen.faltantes) { setError(`No se puede cerrar: faltan ${resumen.faltantes} calificaciones.`); return; }
      if (!await confirmacion.solicitar(`Inscritos: ${resumen.inscritos} · Capturados: ${resumen.capturados} · Faltantes: ${resumen.faltantes}. ¿${siguiente === 'CERRADO' ? 'Cerrar' : 'Reabrir'} periodo?`)) return;
      await api.patch(`/calificaciones/periodos/${claseId}/${parcial}`,{ estatus: siguiente }); setPeriodo({ ...resumen,estatus: siguiente }); setMensaje(`Periodo ${siguiente.toLowerCase()}`);
    } catch (err) { setError(mensajeDeError(err)); } finally { setEnviando(false); }
  };
  const descargarExcel = async () => {
    if (!claseId || descargando) return; setDescargando(true); setError('');
    try { const { data } = await api.get(`/reportes/grupo-materias/${claseId}/calificaciones.xlsx`,{ responseType: 'blob' }); const url = URL.createObjectURL(data), a = document.createElement('a'); a.href = url; a.download = 'calificaciones.xlsx'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 60_000); }
    catch (err) { setError(mensajeDeError(err)); } finally { setDescargando(false); }
  };
  return <>{confirmacion.elemento}
    <Encabezado titulo="Captura de calificaciones" detalle="Evaluación oficial por parcial; las actividades de clase se registran por separado" />
    <p className="texto-ayuda">Selecciona una clase y un periodo, carga la lista, captura o corrige notas y guarda. Al corregir una calificación existente es obligatorio justificar el cambio; el cierre corresponde al personal autorizado.</p>
    {error && <p role="alert" className="mensaje-error">{error}</p>}{mensaje && <p role="status" className="mensaje-ok">{mensaje}</p>}
    <section className="panel"><div className="fila">
      <SelectorBuscable<Clase> ruta="/academico/clases-seleccion" valor={claseId} cambiar={(v) => { limpiar(); setClaseId(v); }} alSeleccionar={(c) => { setClase(c ?? null); if (c?.regimenEvaluacion !== 'CUATRO_PARCIALES_10' && parcial === '4') setParcial('1'); }} etiqueta="Clase" confirmarCambio={cambios.length || borradorImportacion || borradorPonderacion ? confirmarContexto : undefined} deshabilitado={ocupado} texto={(c) => `${c.grupo.plantel.nombre} · ${c.grupo.ciclo.nombre} · ${c.grupo.nombre} · ${c.materia.clave} ${c.materia.nombre}`} />
      <div className="campo"><label htmlFor="parcial-calificacion">Parcial</label><select id="parcial-calificacion" disabled={ocupado} value={parcial} onChange={e=>{const valor=e.target.value;const aplicar=()=>{limpiar();setParcial(valor);};if(cambios.length || borradorImportacion || borradorPonderacion)void confirmarContexto().then(aceptar=>{if(aceptar)aplicar();});else aplicar();}}><option value="1">Parcial 1</option><option value="2">Parcial 2</option><option value="3">Parcial 3</option>{nuevo && <option value="4">Parcial 4</option>}<option value="0">Final</option></select></div>
      <button className="boton secundario" disabled={!clase || ocupado} onClick={cargarAlumnos}>{cargando ? 'Cargando lista…' : 'Cargar lista'}</button>
      <button className="boton secundario" disabled={!clase || ocupado || descargando} onClick={descargarExcel}>{descargando ? 'Descargando…' : 'Descargar Excel'}</button>
    </div>{cargando && <p role="status">Cargando alumnos, notas e historial…</p>}</section>
    {clase && <section className="panel" aria-label="Contexto de la evaluación"><h2>Clase {clase.id}: {clase.materia.clave} · {clase.materia.nombre}</h2><dl className="rejilla-formulario">
      <div><dt>Grupo</dt><dd>{clase.grupo.nombre}</dd></div><div><dt>Plantel</dt><dd>{clase.grupo.plantel.nombre}</dd></div><div><dt>Ciclo</dt><dd>{clase.grupo.ciclo.nombre}</dd></div>
      <div><dt>Nivel académico</dt><dd>{clase.grupo.nivel?.nombre ?? 'Sin nivel registrado'}</dd></div><div><dt>Carrera</dt><dd>{clase.grupo.carrera?.nombre ?? 'Sin carrera registrada'}</dd></div><div><dt>Plan de estudios</dt><dd>{clase.grupo.carrera?.versionPlan ?? 'Sin plan registrado'}</dd></div>
      <div><dt>Periodo académico</dt><dd>{clase.grupo.periodoAcademico?.nombre ?? 'Sin periodo registrado'}</dd></div><div><dt>Turno</dt><dd>{clase.grupo.turno ?? 'Sin turno registrado'}</dd></div>
    </dl><p>Evaluación seleccionada: {parcial === '0' ? (nuevo ? 'Final propuesta y aprobación' : 'Final independiente') : `Parcial ${parcial}`}. {nuevo ? 'Escala 0 a 10; mínima aprobatoria 6. Cuatro parciales mensuales. Sin redondeo automático.' : 'Se conserva la escala actual de 0 a 100.'}</p></section>}
    {!legado && clase && <div className="fila">{trabajo.modo!=='nuevo' && <button type="button" disabled={ocupado} onClick={()=>trabajo.ir('nuevo')}>Capturar esta evaluación</button>}{trabajo.modo!=='importar' && <button type="button" disabled={ocupado} onClick={()=>trabajo.ir('importar')}>Importar esta evaluación</button>}</div>}
    {claseId && <ActaEscolar key={`${claseId}-${parcial}`} claseId={claseId} parcial={parcial} />}
    {claseId && (legado || importando) && <div onChangeCapture={()=>setBorradorImportacion(true)}><ImportarCalificaciones claseId={claseId} parcial={parcial} deshabilitado={ocupado || periodo?.estatus === 'CERRADO'} alConfirmar={() => { setBorradorImportacion(false);trabajo.guardado(); void cargarAlumnos(); }} /></div>}
    {periodo && <section className="panel"><p role="status">Periodo {periodo.estatus.toLowerCase()} · Inscritos: {periodo.inscritos} · Capturados: {periodo.capturados} · Faltantes: {periodo.faltantes}</p>
      {tieneRol('ADMINISTRATIVO') && <button className="boton secundario" disabled={ocupado} onClick={cambiarEstado}>{periodo.estatus === 'ABIERTO' ? 'Cerrar periodo' : 'Reabrir periodo'}</button>}
      {!alumnos.length && <p>Sin inscripciones activas en esta clase.</p>}
    </section>}
    {nuevo && parcial === '0' && periodo && <PropuestasFinal claseId={Number(claseId)} propuestas={propuestas} alumnos={alumnos.map(i=>({id:i.alumno.id,matricula:i.alumno.matricula}))} motivo={motivo} deshabilitado={soloConsulta || importando || ocupado || cambios.length > 0 || periodo.estatus === 'CERRADO'} alOcupado={setPonderando} alGuardar={()=>{trabajo.guardado();void cargarAlumnos();}} />}
    {nuevo && parcial !== '0' && periodo && alumnos.length > 0 && !soloConsulta && !importando && <PonderacionCalificaciones key={`${claseId}-${parcial}`} detalleAnterior={historial.datos.find(c=>c.detalleCalculo)?.detalleCalculo} claseId={Number(claseId)} parcial={Number(parcial)} alumnos={alumnos.map(i=>({id:i.alumno.id,matricula:i.alumno.matricula}))} deshabilitado={ocupado || periodo.estatus === 'CERRADO' || cambios.length > 0} alCambiar={setBorradorPonderacion} alOcupado={setPonderando} alGuardar={()=>void cargarAlumnos()} />}
    {!!alumnos.length && !importando && <form onSubmit={guardar} noValidate aria-busy={enviando}><fieldset disabled={soloConsulta || ocupado || periodo?.estatus === 'CERRADO'} style={{ border: 0,padding: 0 }}><legend>Calificaciones oficiales del parcial seleccionado</legend>
      <p>{nuevo ? 'P1–P4 aportan 25 % cada uno. La propuesta requiere aprobación para ser definitiva; guardar una Final manual también la hace definitiva. Los parciales conservan sus decimales.' : 'Final se muestra por separado; el promedio oficial utiliza P1–P3.'} Deja vacía una nota pendiente. Solo se guardan cambios; los valores vacíos no eliminan notas ya capturadas.</p>
      <div className="tabla-contenedor" role="region" aria-label="Captura de notas por alumno" tabIndex={0}><table className="tabla tabla-adaptable"><caption className="solo-lector">Matrícula, nombre y calificación editable para el periodo seleccionado</caption><thead><tr><th scope="col">Matrícula</th><th scope="col">Alumno</th><th scope="col">Calificación</th></tr></thead><tbody>{alumnos.map(({ alumno: a }) => {
        const invalida = !!valores[a.id] && !valida(valores[a.id], maximo, decimales);
        return <tr key={a.id}><td data-etiqueta="Matrícula">{a.matricula}</td><td data-etiqueta="Alumno">{a.usuario.nombre} {a.usuario.apellidoPaterno}</td><td data-etiqueta="Calificación"><label className="solo-lector" htmlFor={`nota-${a.id}`}>Calificación de {a.matricula}</label><input id={`nota-${a.id}`} type="number" min={0} max={maximo} step="any" value={valores[a.id] ?? ''} aria-invalid={invalida} aria-describedby={invalida ? `error-nota-${a.id}` : undefined} onChange={(e) => setValores({ ...valores,[a.id]: e.target.value })} />{invalida && <span id={`error-nota-${a.id}`} className="mensaje-error">De 0 a {maximo}, hasta {decimales} decimales.</span>}</td></tr>;
      })}</tbody></table></div>
      {!soloConsulta && <><div className="campo"><label htmlFor="motivo-calificacion">Motivo obligatorio al corregir una nota existente</label><input id="motivo-calificacion" required={corrige} maxLength={300} aria-invalid={corrige && !motivo.trim()} value={motivo} onChange={(e) => setMotivo(e.target.value)} /></div>
      <p role="status">{cambios.length} calificaciones con cambios</p><button className="boton">{enviando ? 'Guardando…' : 'Guardar calificaciones'}</button></>}
    </fieldset></form>}
    {periodo && (legado || soloConsulta) && <section className="panel" aria-busy={cargandoHistorial}><h2>Historial del periodo</h2>{cargandoHistorial && <p role="status">Cargando historial…</p>}
      <Paginador total={historial.total} pagina={historial.pagina} porPagina={historial.porPagina} deshabilitado={ocupado || cargandoHistorial} onCambio={cargarHistorial} />
      <div className="tabla-contenedor" role="region" aria-label="Historial de modificaciones de notas" tabIndex={0}><table className="tabla tabla-adaptable"><caption className="solo-lector">Historial de cambios con usuario y motivo de la corrección</caption><thead><tr><th scope="col">Fecha</th><th scope="col">Alumno</th><th scope="col">Anterior</th><th scope="col">Nueva</th><th scope="col">Observación anterior</th><th scope="col">Observación nueva</th><th scope="col">Usuario</th><th scope="col">Motivo</th></tr></thead><tbody>{historial.datos.map((c) => <tr key={c.id}><td data-etiqueta="Fecha">{new Date(c.fecha).toLocaleString('es-MX')}</td><td data-etiqueta="Alumno">{alumnos.find((i) => i.alumno.id === c.alumnoId)?.alumno.matricula ?? c.alumnoId}</td><td data-etiqueta="Anterior">{c.valorAnterior ?? '—'}{c.valorAnterior !== null && ` / ${c.escalaAnterior ?? 100}`}</td><td data-etiqueta="Nueva">{c.valorNuevo} / {c.escalaNueva ?? 100}{c.detalleCalculo && <DetallePonderacion detalle={c.detalleCalculo}/>}</td><td data-etiqueta="Observación anterior">{c.observacionAnterior ?? '—'}</td><td data-etiqueta="Observación nueva">{c.observacionNueva ?? '—'}</td><td data-etiqueta="Usuario">{c.usuarioId}</td><td data-etiqueta="Motivo">{c.motivo ?? '—'}</td></tr>)}{!historial.datos.length && <tr><td colSpan={8}>Sin cambios registrados.</td></tr>}</tbody></table></div>
    </section>}
  </>;
}
