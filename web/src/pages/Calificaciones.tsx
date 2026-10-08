import { FormEvent, useRef, useState } from 'react';
import { api, mensajeDeError } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { useConfirmacion } from '../components/useConfirmacion';
import { SelectorBuscable } from '../components/SelectorBuscable';
import { Paginador } from '../components/Paginador';
import { Encabezado } from '../components/Encabezado';
interface Clase { id: number; grupo: { id: number; nombre: string; ciclo: { nombre: string }; plantel: { nombre: string } }; materia: { clave: string; nombre: string } }
interface Inscripcion { alumno: { id: number; matricula: string; usuario: { nombre: string; apellidoPaterno: string } } }
interface Registro { alumnoId: number; calificacion: number }
interface EstadoPeriodo { estatus: 'ABIERTO' | 'CERRADO'; inscritos: number; capturados: number; faltantes: number }
interface Cambio { id: number; alumnoId: number; valorAnterior: number | null; valorNuevo: number; usuarioId: number; fecha: string; motivo: string | null; observacionAnterior: string | null; observacionNueva: string | null }
interface Historial { datos: Cambio[]; total: number; pagina: number; porPagina: number }
const HISTORIAL_VACIO: Historial = { datos: [], total: 0, pagina: 1, porPagina: 20 };
const valida = (v: string) => /^(?:\d+|\d*\.\d{1,2})$/.test(v) && Number(v) >= 0 && Number(v) <= 100;
export default function CalificacionesPage() {
  const { tieneRol } = useAuth(), confirmacion = useConfirmacion();
  const [claseId,setClaseId] = useState(''), [clase,setClase] = useState<Clase | null>(null), [parcial,setParcial] = useState('1');
  const [alumnos,setAlumnos] = useState<Inscripcion[]>([]), [valores,setValores] = useState<Record<number,string>>({}), [originales,setOriginales] = useState<Record<number,string>>({});
  const [periodo,setPeriodo] = useState<EstadoPeriodo | null>(null), [historial,setHistorial] = useState<Historial>(HISTORIAL_VACIO);
  const [motivo,setMotivo] = useState(''), [error,setError] = useState(''), [mensaje,setMensaje] = useState('');
  const [cargando,setCargando] = useState(false), [enviando,setEnviando] = useState(false), [descargando,setDescargando] = useState(false), [cargandoHistorial,setCargandoHistorial] = useState(false);
  const contexto = useRef(0);
  const invalidos = alumnos.filter((i) => valores[i.alumno.id] && !valida(valores[i.alumno.id]));
  const cambios = alumnos.filter((i) => valores[i.alumno.id] && (originales[i.alumno.id] === undefined || Number(valores[i.alumno.id]) !== Number(originales[i.alumno.id])));
  const corrige = cambios.some((i) => originales[i.alumno.id] !== undefined), ocupado = cargando || enviando;
  const limpiar = () => { contexto.current++; setAlumnos([]); setValores({}); setOriginales({}); setPeriodo(null); setHistorial(HISTORIAL_VACIO); setMotivo(''); setError(''); setMensaje(''); setCargando(false); setCargandoHistorial(false); };
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
      const [insc,notas,estado,auditoria] = await Promise.all([
        api.get<Inscripcion[]>(`/academico/grupos/${clase.grupo.id}/alumnos`),
        api.get<Registro[]>(`/calificaciones/grupo-materia/${clase.id}`,{ params: { parcial } }),
        api.get<EstadoPeriodo>(`/calificaciones/periodos/${clase.id}/${parcial}`),
        api.get<Historial>(`/calificaciones/periodos/${clase.id}/${parcial}/historial`),
      ]);
      if (actual !== contexto.current) return;
      const mapa = Object.fromEntries(notas.data.map((n) => [n.alumnoId,String(n.calificacion)]));
      setAlumnos(insc.data); setValores(mapa); setOriginales(mapa); setPeriodo(estado.data); setHistorial(auditoria.data);
    } catch (err) { if (actual === contexto.current) setError(mensajeDeError(err)); }
    finally { if (actual === contexto.current) setCargando(false); }
  };
  const guardar = async (e: FormEvent) => {
    e.preventDefault(); if (ocupado || !periodo || periodo.estatus === 'CERRADO') return;
    setError(''); setMensaje('');
    if (invalidos.length) { setError('Revisa las calificaciones marcadas: usa de 0 a 100 y hasta dos decimales.'); document.getElementById(`nota-${invalidos[0].alumno.id}`)?.focus(); return; }
    if (!cambios.length) { setMensaje('No hay cambios que guardar.'); return; }
    if (corrige && !motivo.trim()) { setError('Escribe el motivo para corregir las calificaciones existentes.'); document.getElementById('motivo-calificacion')?.focus(); return; }
    setEnviando(true);
    try {
      const { data } = await api.post<{ capturadas: number; sinCambios: number }>('/calificaciones/captura',{ grupoMateriaId: Number(claseId),parcial: Number(parcial),motivo: motivo.trim() || undefined,items: cambios.map((i) => ({ alumnoId: i.alumno.id,calificacion: Number(valores[i.alumno.id]) })) });
      const guardados = { ...originales,...Object.fromEntries(cambios.map((i) => [i.alumno.id,valores[i.alumno.id]])) }; setOriginales(guardados); setValores((v) => ({ ...v,...guardados })); setMotivo(''); setMensaje(`${data.capturadas} calificaciones guardadas`);
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
    try { const { data } = await api.get(`/reportes/grupo-materias/${claseId}/calificaciones.xlsx`,{ responseType: 'blob' }); const url = URL.createObjectURL(data), a = document.createElement('a'); a.href = url; a.download = 'calificaciones.xlsx'; a.click(); URL.revokeObjectURL(url); }
    catch (err) { setError(mensajeDeError(err)); } finally { setDescargando(false); }
  };
  return <>{confirmacion.elemento}
    <Encabezado titulo="Captura de calificaciones" detalle="Evaluación oficial por parcial; las actividades de clase se registran por separado" />
    {error && <p role="alert" className="mensaje-error">{error}</p>}{mensaje && <p role="status" className="mensaje-ok">{mensaje}</p>}
    <section className="panel"><div className="fila">
      <SelectorBuscable<Clase> ruta="/academico/clases-seleccion" valor={claseId} cambiar={(v) => { limpiar(); setClaseId(v); }} alSeleccionar={(c) => setClase(c ?? null)} etiqueta="Clase" deshabilitado={ocupado} texto={(c) => `${c.grupo.plantel.nombre} · ${c.grupo.ciclo.nombre} · ${c.grupo.nombre} · ${c.materia.clave} ${c.materia.nombre}`} />
      <div className="campo"><label htmlFor="parcial-calificacion">Parcial</label><select id="parcial-calificacion" disabled={ocupado} value={parcial} onChange={(e) => { limpiar(); setParcial(e.target.value); }}><option value="1">Parcial 1</option><option value="2">Parcial 2</option><option value="3">Parcial 3</option><option value="0">Final</option></select></div>
      <button className="boton secundario" disabled={!clase || ocupado} onClick={cargarAlumnos}>{cargando ? 'Cargando lista…' : 'Cargar lista'}</button>
      <button className="boton secundario" disabled={!clase || ocupado || descargando} onClick={descargarExcel}>{descargando ? 'Descargando…' : 'Descargar Excel'}</button>
    </div>{cargando && <p role="status">Cargando alumnos, notas e historial…</p>}</section>
    {periodo && <section className="panel"><p role="status">Periodo {periodo.estatus.toLowerCase()} · Inscritos: {periodo.inscritos} · Capturados: {periodo.capturados} · Faltantes: {periodo.faltantes}</p>
      {tieneRol('ADMINISTRATIVO') && <button className="boton secundario" disabled={ocupado} onClick={cambiarEstado}>{periodo.estatus === 'ABIERTO' ? 'Cerrar periodo' : 'Reabrir periodo'}</button>}
      {!alumnos.length && <p>Sin inscripciones activas en esta clase.</p>}
    </section>}
    {!!alumnos.length && <form onSubmit={guardar} noValidate aria-busy={enviando}><fieldset disabled={ocupado || periodo?.estatus === 'CERRADO'} style={{ border: 0,padding: 0 }}><legend>Calificaciones oficiales del parcial seleccionado</legend>
      <p>Deja vacía una nota pendiente. Solo se guardan cambios; los valores vacíos no eliminan notas ya capturadas.</p>
      <table className="tabla"><thead><tr><th>Matrícula</th><th>Alumno</th><th>Calificación</th></tr></thead><tbody>{alumnos.map(({ alumno: a }) => {
        const invalida = !!valores[a.id] && !valida(valores[a.id]);
        return <tr key={a.id}><td>{a.matricula}</td><td>{a.usuario.nombre} {a.usuario.apellidoPaterno}</td><td><label className="solo-lector" htmlFor={`nota-${a.id}`}>Calificación de {a.matricula}</label><input id={`nota-${a.id}`} type="number" min={0} max={100} step={0.01} value={valores[a.id] ?? ''} aria-invalid={invalida} aria-describedby={invalida ? `error-nota-${a.id}` : undefined} onChange={(e) => setValores({ ...valores,[a.id]: e.target.value })} />{invalida && <span id={`error-nota-${a.id}`} className="mensaje-error">De 0 a 100, hasta dos decimales.</span>}</td></tr>;
      })}</tbody></table>
      <div className="campo"><label htmlFor="motivo-calificacion">Motivo obligatorio al corregir una nota existente</label><input id="motivo-calificacion" required={corrige} maxLength={300} aria-invalid={corrige && !motivo.trim()} value={motivo} onChange={(e) => setMotivo(e.target.value)} /></div>
      <p role="status">{cambios.length} calificaciones con cambios</p><button className="boton">{enviando ? 'Guardando…' : 'Guardar calificaciones'}</button>
    </fieldset></form>}
    {periodo && <section className="panel" aria-busy={cargandoHistorial}><h2>Historial del periodo</h2>{cargandoHistorial && <p role="status">Cargando historial…</p>}
      <Paginador total={historial.total} pagina={historial.pagina} porPagina={historial.porPagina} deshabilitado={ocupado || cargandoHistorial} onCambio={cargarHistorial} />
      <table className="tabla"><thead><tr><th>Fecha</th><th>Alumno</th><th>Anterior</th><th>Nueva</th><th>Observación anterior</th><th>Observación nueva</th><th>Usuario</th><th>Motivo</th></tr></thead><tbody>{historial.datos.map((c) => <tr key={c.id}><td>{new Date(c.fecha).toLocaleString('es-MX')}</td><td>{alumnos.find((i) => i.alumno.id === c.alumnoId)?.alumno.matricula ?? c.alumnoId}</td><td>{c.valorAnterior ?? '—'}</td><td>{c.valorNuevo}</td><td>{c.observacionAnterior ?? '—'}</td><td>{c.observacionNueva ?? '—'}</td><td>{c.usuarioId}</td><td>{c.motivo ?? '—'}</td></tr>)}{!historial.datos.length && <tr><td colSpan={8}>Sin cambios registrados.</td></tr>}</tbody></table>
    </section>}
  </>;
}
