import { useEffect, useRef, useState } from 'react';
import { api, mensajeDeError } from '../api/client';
interface Acta { institucion:string;plan:string;periodo:string;ciclo:string;grupo:string;plantel:string;asignatura:string;docente:string;evaluacion:string;escala:string;aviso:string;faltantes:number;filas:{alumnoId:number;matricula:string;nombre:string;calificacion:number|null;observaciones:string}[] }
export function ActaEscolar({claseId,parcial}:{claseId:string;parcial:string}) {
 const [datos,setDatos]=useState<Acta|null>(null),[error,setError]=useState(''),[ocupado,setOcupado]=useState(false);
 const vigente=useRef(0);
 useEffect(()=>{const turno=++vigente.current;setDatos(null);setError('');setOcupado(false);return()=>{vigente.current=turno+1;};},[claseId,parcial]);
 const ejecutar=async(plantilla?:boolean)=>{
  if(ocupado)return;const turno=++vigente.current;setOcupado(true);setError('');
  try {
   if(plantilla===undefined){const {data}=await api.get<Acta>(`/reportes/formatos/acta/${claseId}`,{params:{parcial}});if(turno===vigente.current)setDatos(data);}
   else {const {data}=await api.get(`/reportes/formatos/acta/${claseId}/excel`,{params:{parcial,plantilla},responseType:'blob'});if(turno!==vigente.current)return;
    const url=URL.createObjectURL(data);const a=document.createElement('a');a.href=url;a.download=`acta-${claseId}-${parcial}${plantilla?'-plantilla':''}.xlsx`;a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);}
  }catch(e){if(turno===vigente.current)setError(mensajeDeError(e));}finally{if(turno===vigente.current)setOcupado(false);}
 };
 return <section className="panel" aria-label="Acta de evaluación"><h2>Acta de evaluación</h2><p>Consulta el formato de Control Escolar o descarga el Excel con el listado de alumnos. La plantilla deja vacías las evaluaciones para rellenarlas.</p>
  <div className="fila"><button className="boton secundario" type="button" disabled={ocupado} onClick={()=>void ejecutar()}>Ver acta digital</button><button className="boton secundario" type="button" disabled={ocupado} onClick={()=>void ejecutar(true)}>Descargar acta para rellenar</button><button className="boton secundario" type="button" disabled={ocupado} onClick={()=>void ejecutar(false)}>Descargar acta con notas guardadas</button></div>
  {ocupado&&<p role="status">Preparando acta…</p>}{error&&<p role="alert">{error}<button className="boton secundario" type="button" onClick={()=>void ejecutar()}>Reintentar acta</button></p>}
  {datos&&<><h3>{datos.institucion} · Listas de Evaluación Parcial</h3><p>Plan de estudios: {datos.plan||'Sin registro'} · Periodo: {datos.periodo||'Sin registro'} · Ciclo: {datos.ciclo}</p><p>Asignatura: {datos.asignatura} · Profesor(a): {datos.docente||'Sin asignar'} · Grupo: {datos.grupo} · Plantel: {datos.plantel}</p><p>{datos.evaluacion} · Escala: {datos.escala} · {datos.faltantes} notas pendientes.</p>
  <div className="tabla-contenedor" role="region" aria-label="Acta digital por alumno" tabIndex={0}><table className="tabla"><caption>Asistencias (.) · Inasistencias (F)</caption><thead><tr>{['N° Lista','Matrícula','Nombre del alumno','Asistencias','Faltas','Evaluación continua','Examen','Calificación parcial','Observaciones'].map(h=><th key={h} scope="col">{h}</th>)}</tr></thead><tbody>{datos.filas.map((f,i)=><tr key={f.alumnoId}><td>{i+1}</td><td>{f.matricula}</td><td>{f.nombre}</td>{['Asistencias','Faltas','Evaluación continua','Examen'].map(h=><td key={h} aria-label={`${h}: sin registro`}>—</td>)}<td>{f.calificacion??'Pendiente'}</td><td>{f.observaciones}</td></tr>)}</tbody></table></div><p className="texto-ayuda">{datos.aviso}</p><p>Firma profesor(a) __________________ · Firma coordinación __________________ · Firma Control Escolar __________________</p><p>Para guardar o corregir notas utiliza la captura de calificaciones; después actualiza el acta. Para cargar desde Excel utiliza la plantilla de importación, no este formato de impresión.</p></>}
 </section>;
}
