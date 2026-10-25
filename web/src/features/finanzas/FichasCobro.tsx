import { FormEvent, useRef, useState } from 'react';
import { api, mensajeDeError } from '../../api/client';
import { pesos } from '../../utils/formato';
import { SelectorBuscable } from '../../components/SelectorBuscable';
type Cargo = { id:number; descripcion:string; monto:number; descuento:number; recargo:number; estatus:string };
interface Ficha { identificador:string;cargoId:number;concepto:string;periodo:string|null;vencimiento:string|null;
  total:number;saldo:number;estatus:string;alumno:{nombre:string;matricula:string};plantel:string;
  banco:{nombre:string;titular:string;cuenta:string;clabe:string|null}|null }
export function FichasCobro() {
  const [cargoId,setCargoId]=useState(''),[ficha,setFicha]=useState<Ficha|null>(null);
  const [monto,setMonto]=useState(''),[metodo,setMetodo]=useState<'EFECTIVO'|'TRANSFERENCIA'>('TRANSFERENCIA');
  const [folio,setFolio]=useState(''),[confirmado,setConfirmado]=useState(false);
  const [ocupado,setOcupado]=useState(false),[error,setError]=useState(''),[exito,setExito]=useState('');
  const intento=useRef<{firma:string;clave:string}|null>(null);
  const consultar=async(e:FormEvent)=>{e.preventDefault();if(ocupado||!cargoId)return;setOcupado(true);setError('');setExito('');setFicha(null);
    try {const {data}=await api.get<Ficha>('/finanzas/fichas/'+Number(cargoId));setFicha(data);setMonto(data.saldo>0?String(data.saldo):'');}
    catch(err){setError(mensajeDeError(err));}finally{setOcupado(false);}
  };
  const pdf=async()=>{if(!ficha||ocupado)return;setOcupado(true);setError('');
    try{const {data}=await api.get('/finanzas/fichas/'+ficha.cargoId+'/pdf',{responseType:'blob'});
      const url=URL.createObjectURL(data);const enlace=document.createElement('a');enlace.href=url;
      enlace.download='ficha-'+ficha.identificador+'.pdf';enlace.click();window.setTimeout(()=>URL.revokeObjectURL(url),1000);
    }catch(e){setError(mensajeDeError(e));}finally{setOcupado(false);}
  };
  const registrar=async(e:FormEvent)=>{e.preventDefault();if(ocupado||!confirmado||!ficha)return;setOcupado(true);setError('');setExito('');
    const datos={identificador:ficha.identificador,monto:Number(monto),metodo,referenciaBancaria:folio.trim(),confirmado:true};
    const firma=JSON.stringify(datos);if(intento.current?.firma!==firma)intento.current={firma,clave:crypto.randomUUID()};
    try{await api.post('/finanzas/fichas/registrar',{...datos,claveIdempotencia:intento.current.clave});
      intento.current=null;setFolio('');setConfirmado(false);setExito('Pago registrado. Se actualizó el saldo del cargo.');
      const {data}=await api.get<Ficha>('/finanzas/fichas/'+ficha.cargoId);
      setFicha(data);setMonto(data.saldo>0?String(data.saldo):'');
    }catch(err){setError(mensajeDeError(err));}finally{setOcupado(false);}
  };
  return <section className="panel">
    <h2>Fichas BBVA y recepción de pagos</h2>
    <p>Busca un cargo y descarga su PDF. No confirmes fondos solo por recibir un identificador: revisa primero el depósito en BBVA o ventanilla.</p>
    <form onSubmit={consultar} className="fila">
      <SelectorBuscable<Cargo> ruta="/finanzas/cargos" valor={cargoId} cambiar={id=>{setCargoId(id);setFicha(null);}} etiqueta="Cargo" texto={c=>'#'+c.id+' · '+c.descripcion+' · '+pesos(c.monto-c.descuento+c.recargo)+' · '+c.estatus}/>
      <button className="boton" disabled={ocupado||!cargoId}>Consultar ficha</button>
    </form>
    {ficha&&<div>
      <h3>{ficha.identificador}</h3>
      <p>{ficha.alumno.nombre} · Matrícula: {ficha.alumno.matricula} · Plantel: {ficha.plantel}</p>
      <p>{ficha.concepto} · {ficha.periodo||'Sin periodo'} · Vence: {ficha.vencimiento||'No definido'} · {ficha.estatus}</p>
      <p><strong>Saldo: {pesos(ficha.saldo)}</strong></p>
      {ficha.banco?<p>BBVA · {ficha.banco.titular} · Cuenta: {ficha.banco.cuenta}</p>:<p role="status">Sin cuenta BBVA habilitada. SUPERADMIN debe configurarla.</p>}
      <button type="button" className="boton" disabled={ocupado||!ficha.banco||ficha.estatus==='CANCELADO'} onClick={()=>void pdf()}>Descargar ficha PDF</button>
      {ficha.saldo>0&&ficha.estatus!=='CANCELADO'&&<form onSubmit={registrar} className="panel">
        <h3>Aplicar un pago verificado</h3>
        <div className="fila">
          <div className="campo"><label htmlFor="ficha-monto">Monto verificado (MXN)</label><input id="ficha-monto" required type="number" min="0.01" max={ficha.saldo} step="0.01" value={monto} onChange={e=>setMonto(e.target.value)}/></div>
          <div className="campo"><label htmlFor="ficha-metodo">Método</label><select id="ficha-metodo" value={metodo} onChange={e=>setMetodo(e.target.value as 'EFECTIVO'|'TRANSFERENCIA')}><option value="TRANSFERENCIA">Transferencia o depósito</option><option value="EFECTIVO">Efectivo</option></select></div>
          <div className="campo"><label htmlFor="ficha-folio">Folio bancario o de ventanilla</label><input id="ficha-folio" required minLength={5} maxLength={60} value={folio} onChange={e=>setFolio(e.target.value)}/></div>
        </div>
        <label><input required type="checkbox" checked={confirmado} onChange={e=>setConfirmado(e.target.checked)}/>Confirmo que cotejé el depósito y sus fondos de manera independiente.</label>
        <button className="boton" disabled={ocupado||!confirmado}>Registrar pago confirmado</button>
      </form>}
    </div>}
    {error&&<p role="alert" className="mensaje-error">{error}</p>}
    {exito&&<p role="status" className="mensaje-ok">{exito}</p>}
  </section>;
}
