import { FormEvent, useEffect, useState } from 'react';
import { api, mensajeDeError } from '../../api/client';
interface Banco { titular?:string; numeroCuenta?:string; clabe?:string|null; activo:boolean }
export function ConfiguracionBbva() {
  const [titular,setTitular]=useState(''),[cuenta,setCuenta]=useState(''),[clabe,setClabe]=useState('');
  const [activo,setActivo]=useState(true),[cargando,setCargando]=useState(true),[enviando,setEnviando]=useState(false);
  const [error,setError]=useState(''),[exito,setExito]=useState('');
  useEffect(()=>{let vigente=true;
    api.get<Banco>('/configuracion/bbva').then(({data})=>{
      if(!vigente)return;setTitular(data.titular??'');setCuenta(data.numeroCuenta??'');setClabe(data.clabe??'');setActivo(data.activo);
    }).catch(e=>{if(vigente)setError(mensajeDeError(e));}).finally(()=>{if(vigente)setCargando(false);});
    return()=>{vigente=false;};
  },[]);
  const guardar=async(e:FormEvent)=>{e.preventDefault();if(enviando)return;setEnviando(true);setError('');setExito('');
    try {await api.put('/configuracion/bbva',{titular,numeroCuenta:cuenta,clabe:clabe||null,activo});setExito('Cuenta BBVA actualizada. Verifica una ficha de prueba.');}
    catch(e){setError(mensajeDeError(e));}finally{setEnviando(false);}
  };
  return <form className="panel" onSubmit={guardar} aria-busy={enviando||cargando}>
    <h2>Cuenta de depósito BBVA</h2>
    <p>Solo SUPERADMIN puede cambiar esta cuenta. Los datos se imprimen en las fichas; verifica la autorización institucional. El identificador IUA no es referencia bancaria homologada.</p>
    {cargando&&<p role="status">Cargando cuenta…</p>}
    {!cargando&&<><div className="fila">
      <div className="campo"><label htmlFor="bbva-titular">Titular de la cuenta</label><input id="bbva-titular" required minLength={3} maxLength={150} value={titular} onChange={e=>setTitular(e.target.value)}/></div>
      <div className="campo"><label htmlFor="bbva-cuenta">Cuenta BBVA (10 dígitos)</label><input id="bbva-cuenta" required pattern="[0-9]{10}" inputMode="numeric" maxLength={10} value={cuenta} onChange={e=>setCuenta(e.target.value)}/></div>
      <div className="campo"><label htmlFor="bbva-clabe">CLABE interbancaria (opcional)</label><input id="bbva-clabe" pattern="[0-9]{18}" inputMode="numeric" maxLength={18} value={clabe} onChange={e=>setClabe(e.target.value)}/></div>
      <label><input type="checkbox" checked={activo} onChange={e=>setActivo(e.target.checked)}/>Habilitar cuenta para emitir fichas</label>
    </div><button className="boton" disabled={enviando}>{enviando?'Guardando…':'Guardar cuenta BBVA'}</button></>}
    {error&&<p role="alert" className="mensaje-error">{error}</p>}{exito&&<p role="status" className="mensaje-ok">{exito}</p>}
  </form>;
}
