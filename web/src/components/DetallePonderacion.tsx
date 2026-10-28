export function criteriosDelDetalle(detalle?:string|null):{nombre:string;porcentaje:string}[]|null {
 try {
  const valor:unknown=JSON.parse(detalle??'null');
  if(!valor || typeof valor!=='object' || !('criterios' in valor) || !Array.isArray(valor.criterios) || !valor.criterios.length || valor.criterios.length>20)return null;
  const lista=valor.criterios.map((c:unknown)=>c && typeof c==='object' && 'nombre' in c && 'porcentaje' in c && typeof c.nombre==='string' && typeof c.porcentaje==='number' ? {nombre:c.nombre,porcentaje:String(c.porcentaje)}:null);
  return lista.every((c):c is {nombre:string;porcentaje:string}=>c!==null)?lista:null;
 }catch{return null;}
}
export function DetallePonderacion({detalle}:{detalle:string}) {
 try {
  const valor:unknown=JSON.parse(detalle);
  if(valor && typeof valor==='object' && 'tipo' in valor && valor.tipo==='APROBACION_FINAL' && 'calificacion' in valor && 'parciales' in valor && Array.isArray(valor.parciales)) return <details><summary>Ver aprobación de Final</summary><p>Propuesta aprobada: {String(valor.calificacion)}</p><ul>{valor.parciales.map((p:unknown,i:number)=>p && typeof p==='object' && 'parcial' in p && 'calificacion' in p && 'escalaMaxima' in p ? <li key={i}>Parcial {String(p.parcial)}: {String(p.calificacion)} / {String(p.escalaMaxima)} · 25 %</li>:null)}</ul></details>;
  if(!valor || typeof valor!=='object' || !('criterios' in valor) || !('notas' in valor) || !Array.isArray(valor.criterios) || !Array.isArray(valor.notas)) return <span>Detalle no disponible</span>;
  const notas=valor.notas as unknown[];
  return <details><summary>Ver criterios del cálculo</summary><ul>{valor.criterios.map((c:unknown,i:number)=>c && typeof c==='object' && 'nombre' in c && 'porcentaje' in c ? <li key={i}>{String(c.nombre)}: {String(c.porcentaje)} % · Nota: {String(notas[i]??'Pendiente')}</li>:null)}</ul></details>;
 }catch{return <span>Detalle no disponible</span>;}
}
