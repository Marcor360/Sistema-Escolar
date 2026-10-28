import { esRegimenNuevo, parcialesDe } from '../common/regimen-evaluacion';
/** Una Final manual publicada sustituye el promedio nuevo, sin saltarse el cierre autorizado. */
export function boletaPublicable(clases: {id:number;regimenEvaluacion?:string}[],notas:{grupoMateriaId:number;parcial:number}[],periodos:{grupoMateriaId:number;parcial:number;estatus:string}[]):boolean {
 return clases.length>0 && clases.every(c => {
  const completa = (parcial:number) => notas.some(n=>n.grupoMateriaId===c.id&&n.parcial===parcial) && periodos.some(p=>p.grupoMateriaId===c.id&&p.parcial===parcial&&p.estatus==='CERRADO');
  if (esRegimenNuevo(c) && notas.some(n=>n.grupoMateriaId===c.id&&n.parcial===0)) return completa(0);
  return parcialesDe(c).every(completa);
 });
}
