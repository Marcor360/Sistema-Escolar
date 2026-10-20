/** Se conserva el contrato de promedio P1–P3: no se infiere publicación por tener una nota Final. */
export function boletaPublicable(clases: {id:number}[],notas:{grupoMateriaId:number;parcial:number}[],periodos:{grupoMateriaId:number;parcial:number;estatus:string}[]):boolean {
 return clases.length>0 && clases.every(c=>[1,2,3].every(parcial=>notas.some(n=>n.grupoMateriaId===c.id&&n.parcial===parcial)&&periodos.some(p=>p.grupoMateriaId===c.id&&p.parcial===parcial&&p.estatus==='CERRADO')));
}
