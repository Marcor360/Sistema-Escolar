import { useEffect, useState } from 'react';
import { api, mensajeDeError } from '../../api/client';
import { GraficaCobranza } from '../../components/GraficaCobranza';
import { pesos } from '../../utils/formato';
interface Resumen {
  saldoPendiente:number; cargosConAdeudo:number; cobradoMes:number;
  alumnosConSaldo:number; alumnosSinAbono:number; alumnosConAbonoParcial:number; alumnosConVencidos:number;
}
export function PanelIndicadoresFinanzas() {
  const [planteles,setPlanteles]=useState<{id:number;nombre:string}[]>([]);
  const [plantel,setPlantel]=useState('');
  const [resumen,setResumen]=useState<Resumen|null>(null);
  const [cargando,setCargando]=useState(true),[error,setError]=useState(''),[revision,setRevision]=useState(0);
  useEffect(()=>{
    let activo=true;
    api.get<{id:number;nombre:string}[]>('/planteles/mios')
      .then(({data})=>{if(activo)setPlanteles(data);}).catch(e=>{if(activo)setError(mensajeDeError(e));});
    return()=>{activo=false;};
  },[]);
  useEffect(()=>{
    let activo=true;
    setResumen(null);setError('');setCargando(true);
    api.get<Resumen>('/reportes/resumen',{params:plantel?{plantelId:Number(plantel)}:{}})
      .then(({data})=>{if(activo)setResumen(data);}).catch(e=>{if(activo)setError(mensajeDeError(e));})
      .finally(()=>{if(activo)setCargando(false);});
    return()=>{activo=false;};
  },[plantel,revision]);
  const metricas=resumen?[
    {titulo:'Cobrado este mes',valor:pesos(resumen.cobradoMes)},
    {titulo:'Saldo por cobrar',valor:pesos(resumen.saldoPendiente)},
    {titulo:'Alumnos con saldo',valor:resumen.alumnosConSaldo},
    {titulo:'Sin abonos pendientes',valor:resumen.alumnosSinAbono},
    {titulo:'Con abonos parciales',valor:resumen.alumnosConAbonoParcial},
    {titulo:'Con cargos vencidos',valor:resumen.alumnosConVencidos},
    {titulo:'Cargos con adeudo',valor:resumen.cargosConAdeudo},
  ]:[];
  return <section aria-label="Indicadores financieros">
    <h2>Indicadores de cobranza</h2><p>Visualiza ingresos confirmados y obligaciones pendientes por plantel. Los recuentos de alumnos no son recuentos de cargos.</p>
    <div className="fila"><label htmlFor="indicadores-plantel">Plantel</label>
      <select id="indicadores-plantel" value={plantel} onChange={e=>setPlantel(e.target.value)}>
        <option value="">Todos mis planteles</option>{planteles.map(p=><option value={p.id} key={p.id}>{p.nombre}</option>)}
      </select>
      <button className="boton secundario" onClick={()=>setRevision(n=>n+1)} disabled={cargando}>Actualizar indicadores</button>
    </div>
    {cargando&&<p role="status">Cargando indicadores…</p>}
    {error&&<p role="alert">{error}</p>}
    {resumen&&<div className="kpis">{metricas.map(m=><article className="kpi" key={m.titulo}>
      <p className="etiqueta">{m.titulo}</p><p className="valor">{m.valor}</p>
    </article>)}</div>}
    <GraficaCobranza plantelId={plantel}/>
  </section>;
}
