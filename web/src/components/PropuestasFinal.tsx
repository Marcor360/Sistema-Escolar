import { useRef, useState } from 'react';
import { api, mensajeDeError } from '../api/client';
export interface PropuestaFinal { alumnoId:number; propuesta:number|null; definitiva:number|null; revision:string }
export function PropuestasFinal({claseId,propuestas,alumnos,motivo,deshabilitado,alOcupado,alGuardar}:{claseId:number;propuestas:PropuestaFinal[];alumnos:{id:number;matricula:string}[];motivo:string;deshabilitado:boolean;alOcupado:(valor:boolean)=>void;alGuardar:()=>void}) {
 const [error,setError]=useState(''),[mensaje,setMensaje]=useState(''),[enviando,setEnviando]=useState(false),bloqueo=useRef(false);
 const aprobar=async(p:PropuestaFinal)=>{
  if(deshabilitado || bloqueo.current || p.propuesta===null)return;
  if(p.definitiva!==null && !motivo.trim()){setError('Escribe el motivo para sustituir la Final existente por la propuesta.');return;}
  bloqueo.current=true;setEnviando(true);alOcupado(true);setError('');setMensaje('');
  try {await api.post('/calificaciones/final/aprobar',{grupoMateriaId:claseId,alumnoId:p.alumnoId,revision:p.revision,motivo:motivo.trim()||undefined});setMensaje('Final aprobada y guardada.');alGuardar();}
  catch(err){setError(mensajeDeError(err));}
  finally {bloqueo.current=false;setEnviando(false);alOcupado(false);}
 };
 return <section className="panel" aria-busy={enviando}><h2>Propuestas de calificación Final</h2><p>Promedio de cuatro parciales al 25 %. No es definitivo hasta aprobarlo. Puedes aprobar la propuesta o capturar otra nota en la tabla de calificaciones. Una Final guardada no cambia al corregir parciales; debe revisarse expresamente.</p>
 {error && <p role="alert">{error}</p>}{mensaje && <p role="status">{mensaje}</p>}
 <div className="tabla-contenedor"><table className="tabla tabla-adaptable"><thead><tr><th>Matrícula</th><th>Propuesta automática</th><th>Final definitiva</th><th>Aprobación</th></tr></thead><tbody>{propuestas.map(p=><tr key={p.alumnoId}><td data-etiqueta="Matrícula">{alumnos.find(a=>a.id===p.alumnoId)?.matricula??p.alumnoId}</td><td data-etiqueta="Propuesta automática">{p.propuesta??'Faltan parciales'}</td><td data-etiqueta="Final definitiva">{p.definitiva??'Pendiente de aprobación'}</td><td data-etiqueta="Aprobación"><button type="button" disabled={deshabilitado || enviando || p.propuesta===null} onClick={()=>void aprobar(p)} aria-label={`Aprobar propuesta de ${alumnos.find(a=>a.id===p.alumnoId)?.matricula??p.alumnoId}`}>{p.definitiva===null?'Aprobar propuesta':'Sustituir por propuesta'}</button></td></tr>)}</tbody></table></div></section>;
}
