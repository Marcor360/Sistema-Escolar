import { criteriosDelDetalle } from './DetallePonderacion';
import { useEffect, useRef, useState } from 'react';
import { api, mensajeDeError } from '../api/client';
interface Props {detalleAnterior?:string|null;claseId:number;parcial:number;alumnos:{id:number;matricula:string}[];deshabilitado:boolean;alCambiar:(valor:boolean)=>void;alOcupado:(valor:boolean)=>void;alGuardar:()=>void}
export function PonderacionCalificaciones({detalleAnterior,claseId,parcial,alumnos,deshabilitado,alCambiar,alOcupado,alGuardar}:Props) {
 const [abierto,setAbierto]=useState(false),[criterios,setCriterios]=useState(()=>criteriosDelDetalle(detalleAnterior)??[{nombre:'Entregables',porcentaje:'40'},{nombre:'Exámenes',porcentaje:'40'},{nombre:'Participación',porcentaje:'20'}]);
 const [notas,setNotas]=useState<Record<string,string>>({}),[motivo,setMotivo]=useState(''),[error,setError]=useState(''),[guardando,setGuardando]=useState(false);
 const vigente=useRef(true);useEffect(()=>{vigente.current=true;return()=>{vigente.current=false;};},[]);
 const suma=criterios.reduce((s,c)=>s+Math.round(Number(c.porcentaje)*100),0);
 const cambiar=()=>{alCambiar(true);setError('');};
 const guardar=async()=>{
  if(guardando || deshabilitado)return;
  if(suma!==10000 || criterios.some(c=>!c.nombre.trim() || Number(c.porcentaje)<=0)){setError('Define nombres y porcentajes positivos que sumen 100 %.');return;}
  if(alumnos.some(a=>criterios.some((_,i)=>!/^\d+(?:\.\d{1,2})?$/.test(notas[`${a.id}-${i}`] ?? '') || Number(notas[`${a.id}-${i}`])>10))){setError('Completa cada criterio de cada alumno con una nota de 0 a 10, hasta dos decimales. Un campo vacío no es cero.');return;}
  setGuardando(true);alOcupado(true);setError('');
  try {
   await api.post('/calificaciones/captura-ponderada',{grupoMateriaId:claseId,parcial,criterios:criterios.map(c=>({nombre:c.nombre.trim(),porcentaje:Number(c.porcentaje)})),motivo:motivo.trim()||undefined,items:alumnos.map(a=>({alumnoId:a.id,notas:criterios.map((_,i)=>Number(notas[`${a.id}-${i}`]))}))});
   if(!vigente.current)return;alOcupado(false);alCambiar(false);setAbierto(false);setNotas({});setMotivo('');alGuardar();
  }catch(e){if(vigente.current)setError(mensajeDeError(e));}finally{if(vigente.current){setGuardando(false);alOcupado(false);}}
 };
 return <section className="panel" aria-label="Evaluación por porcentajes"><h3>Evaluación por porcentajes</h3><p>Define los criterios de este parcial. El cálculo se realiza en el servidor y conserva los porcentajes y notas en el historial. No modifica notas de actividades ni redondea el parcial.</p>
 {!abierto?<button type="button" disabled={deshabilitado} onClick={()=>setAbierto(true)}>Capturar por porcentajes</button>:<fieldset disabled={deshabilitado||guardando}><legend>Criterios y notas del parcial {parcial}</legend>
 {criterios.map((c,i)=><div className="fila" key={i}><label>Criterio {i+1}<input maxLength={100} value={c.nombre} onChange={e=>{cambiar();setCriterios(criterios.map((v,j)=>j===i?{...v,nombre:e.target.value}:v));}}/></label><label>Porcentaje {i+1}<input type="number" min="0.01" max="100" step="0.01" value={c.porcentaje} onChange={e=>{cambiar();setCriterios(criterios.map((v,j)=>j===i?{...v,porcentaje:e.target.value}:v));}}/></label><button type="button" disabled={criterios.length===1} onClick={()=>{cambiar();setCriterios(criterios.filter((_,j)=>j!==i));setNotas({});}}>Quitar criterio {i+1}</button></div>)}
 <p>Suma: {suma/100} %</p><button type="button" disabled={criterios.length>=20} onClick={()=>{cambiar();setCriterios([...criterios,{nombre:'',porcentaje:''}]);}}>Añadir criterio</button>
 <div className="tabla-contenedor" role="region" aria-label="Notas por criterio" tabIndex={0}><table className="tabla"><thead><tr><th>Matrícula</th>{criterios.map((c,i)=><th key={i}>{c.nombre||`Criterio ${i+1}`}</th>)}</tr></thead><tbody>{alumnos.map(a=><tr key={a.id}><th>{a.matricula}</th>{criterios.map((c,i)=><td key={i}><input aria-label={`${a.matricula}: ${c.nombre||`Criterio ${i+1}`}`} type="number" min="0" max="10" step="0.01" value={notas[`${a.id}-${i}`]??''} onChange={e=>{cambiar();setNotas({...notas,[`${a.id}-${i}`]:e.target.value});}}/></td>)}</tr>)}</tbody></table></div>
 <label>Motivo al sustituir notas existentes<input maxLength={300} value={motivo} onChange={e=>{cambiar();setMotivo(e.target.value);}}/></label>
 {error&&<p role="alert">{error}</p>}<button type="button" onClick={()=>void guardar()}>{guardando?'Guardando cálculo…':'Calcular y guardar parcial'}</button>
 </fieldset>}
 </section>;
}
