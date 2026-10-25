import { FormEvent, useEffect, useRef, useState } from 'react';
import { api, mensajeDeError } from '../../api/client';
import { pesos } from '../../utils/formato';
import { SelectorBuscable } from '../../components/SelectorBuscable';
import { CONTEXTO_VACIO, ContextoAcademicoSelector, type ContextoAcademicoValor } from '../../components/ContextoAcademicoSelector';

type Modalidad = 'SECUNDARIA' | 'BACHILLERATO' | 'SUPERIOR' | 'ADICIONAL';
export interface DatosCotizados {
  modalidad: Modalidad; total: number; mesInicio: string; diaVencimiento: number;
  importes?: number[]; numeroCuotas?: number;
}
interface Cuota { numero:number; periodo:string; fechaVencimiento:string; monto:number; etiqueta:string; cargoId:number|null }
interface Programacion { id:number; alumnoId:number; conceptoId:number; plantelId:number; cicloId:number; modalidad:Modalidad; total:number; cuotas:Cuota[] }
interface Plantel {id:number;nombre:string}
interface Ciclo {id:number;clave:string;estado:string}
interface Concepto {id:number;clave:string;nombre:string;tipo:string;activo:boolean}
interface Alumno {id:number;matricula:string;usuario:{nombre:string;apellidoPaterno:string}}
interface Periodo {id:number;nombre:string;tipo:string;numero:number}

export function ConfirmarProgramacion({ cotizacion }: { cotizacion: DatosCotizados }) {
  const [planteles,setPlanteles]=useState<Plantel[]>([]);
  const [ciclos,setCiclos]=useState<Ciclo[]>([]);
  const [conceptos,setConceptos]=useState<Concepto[]>([]);
  const [plantelId,setPlantelId]=useState('');
  const [alumnoId,setAlumnoId]=useState('');
  const [cicloId,setCicloId]=useState('');
  const [contexto,setContexto]=useState<ContextoAcademicoValor>(CONTEXTO_VACIO);
  const [conceptoId,setConceptoId]=useState('');
  const [segundoPeriodo,setSegundoPeriodo]=useState('');
  const [ocupado,setOcupado]=useState(false);
  const [cargando,setCargando]=useState(true);
  const [error,setError]=useState('');
  const [mensaje,setMensaje]=useState('');
  const [plan,setPlan]=useState<Programacion|null>(null);
  const [consultaId,setConsultaId]=useState('');
  const intento=useRef<{firma:string;clave:string}|null>(null);

  useEffect(()=>{let vigente=true;
    Promise.all([api.get<Plantel[]>('/planteles/mios'),api.get<Ciclo[]>('/academico/ciclos'),api.get<Concepto[]>('/finanzas/conceptos')])
      .then(([p,c,k])=>{if(!vigente)return;setPlanteles(p.data);setCiclos(c.data);setConceptos(k.data);})
      .catch(err=>{if(vigente)setError(mensajeDeError(err));})
      .finally(()=>{if(vigente)setCargando(false);});
    return()=>{vigente=false;};
  },[]);

  const consultar=async(e:FormEvent)=>{e.preventDefault();if(ocupado||!consultaId)return;setOcupado(true);setError('');setMensaje('');setPlan(null);
    try{const {data}=await api.get<Programacion>('/finanzas/programaciones/'+Number(consultaId));setPlan(data);}
    catch(err){setError(mensajeDeError(err));}finally{setOcupado(false);}
  };
  const cambiar=()=>{setPlan(null);setMensaje('');setError('');};
  const opciones=conceptos.filter(c=>c.activo&&(cotizacion.modalidad==='ADICIONAL'?c.tipo==='OTRO':cotizacion.modalidad==='SECUNDARIA'?['OTRO','COLEGIATURA'].includes(c.tipo):c.tipo==='COLEGIATURA'));
  const confirmar=async(e:FormEvent)=>{e.preventDefault();if(ocupado)return;setOcupado(true);setError('');setMensaje('');
    const datos={...cotizacion,alumnoId:Number(alumnoId),plantelId:Number(plantelId),cicloId:Number(cicloId),conceptoId:Number(conceptoId),periodoAcademicoId:Number(contexto.periodoAcademicoId),...(cotizacion.modalidad==='BACHILLERATO'?{segundoPeriodoAcademicoId:Number(segundoPeriodo)}:{})};
    const firma=JSON.stringify(datos);
    if(intento.current?.firma!==firma)intento.current={firma,clave:crypto.randomUUID()};
    try{const {data}=await api.post<Programacion>('/finanzas/programaciones/confirmar',{...datos,idempotencia:intento.current.clave,confirmado:true});
      setPlan(data);setMensaje('Programación autorizada. Todavía no se generaron cargos: emite cada cuota únicamente después de confirmar el periodo de inscripción.');
    }catch(err){setError(mensajeDeError(err));}finally{setOcupado(false);}
  };
  const emitir=async(numero:number)=>{if(ocupado||!plan)return;setOcupado(true);setError('');setMensaje('');
    try{await api.post('/finanzas/programaciones/'+plan.id+'/cuotas/'+numero+'/emitir',{confirmado:true});
      const {data}=await api.get<Programacion>('/finanzas/programaciones/'+plan.id);setPlan(data);
      setMensaje('Cargo emitido para la cuota '+numero+'. Puedes generar su ficha BBVA desde el identificador del cargo.');
    }catch(err){setError(mensajeDeError(err));}finally{setOcupado(false);}
  };
  const descargar=async(cargoId:number)=>{if(ocupado)return;setOcupado(true);setError('');
    try{const {data}=await api.get('/finanzas/fichas/'+cargoId+'/pdf',{responseType:'blob'});
      const url=URL.createObjectURL(data);const enlace=document.createElement('a');enlace.href=url;
      enlace.download='ficha-IUA-C'+String(cargoId).padStart(10,'0')+'.pdf';enlace.click();
      window.setTimeout(()=>URL.revokeObjectURL(url),1000);
    }catch(err){setError(mensajeDeError(err));}finally{setOcupado(false);}
  };

  return <section className="panel" aria-label="Autorizar programación de cobros">
    <h3>Vincular la cotización con un alumno inscrito</h3>
    <p>La programación se guarda por alumno y periodo académico; no modifica inscripciones. Cada emisión de cuota crea un cargo separado y conserva su propia ficha, identificador y saldo.</p>
    <form onSubmit={consultar} className="fila">
      <div className="campo"><label htmlFor="prog-consulta">Número de programación guardada</label><input id="prog-consulta" required type="number" min="1" step="1" value={consultaId} onChange={e=>setConsultaId(e.target.value)}/></div>
      <button className="boton" disabled={ocupado||!consultaId}>Consultar programación</button>
    </form>
    {plan&&<button type="button" disabled={ocupado} onClick={()=>{setPlan(null);setMensaje('');}}>Preparar otra programación</button>}
    {cargando&&<p role="status">Cargando alumnos y catálogos…</p>}
    {!cargando&&<form onSubmit={confirmar}>
      <fieldset disabled={ocupado||!!plan}><legend>Contexto académico real</legend>
        <label htmlFor="prog-plantel">Plantel</label><select id="prog-plantel" value={plantelId} required onChange={e=>{setPlantelId(e.target.value);setAlumnoId('');setContexto(CONTEXTO_VACIO);setSegundoPeriodo('');cambiar();}}>
          <option value="">Selecciona…</option>{planteles.map(p=><option key={p.id} value={p.id}>{p.nombre}</option>)}</select>
        {plantelId&&<SelectorBuscable<Alumno> ruta="/finanzas/alumnos" valor={alumnoId} cambiar={id=>{setAlumnoId(id);cambiar();}} etiqueta="Alumno" filtros={{plantelId}} texto={a=>a.matricula+' — '+a.usuario.nombre+' '+a.usuario.apellidoPaterno}/>}
        <label htmlFor="prog-ciclo">Ciclo escolar</label><select id="prog-ciclo" value={cicloId} required onChange={e=>{setCicloId(e.target.value);setContexto(CONTEXTO_VACIO);setSegundoPeriodo('');cambiar();}}>
          <option value="">Selecciona…</option>{ciclos.filter(c=>['ACTIVO','PREPARACION'].includes(c.estado)).map(c=><option key={c.id} value={c.id}>{c.clave}</option>)}</select>
        <ContextoAcademicoSelector plantelId={plantelId} cicloId={cicloId} valor={contexto} cambiar={valor=>{setContexto(valor);setSegundoPeriodo('');cambiar();}} />
        {cotizacion.modalidad==='BACHILLERATO'&&contexto.carreraId&&<SelectorBuscable<Periodo> ruta="/academico/catalogos/periodos" etiqueta="Segundo semestre consecutivo del mismo ciclo" valor={segundoPeriodo} cambiar={id=>{setSegundoPeriodo(id);cambiar();}}
          filtros={{plantelId,carreraId:contexto.carreraId,cicloId}} texto={p=>p.nombre+' · '+p.tipo+' '+p.numero}/>}
        <label htmlFor="prog-concepto">Concepto autorizado por Finanzas</label>
        <select id="prog-concepto" value={conceptoId} required onChange={e=>{setConceptoId(e.target.value);cambiar();}}><option value="">Selecciona…</option>
          {opciones.map(c=><option key={c.id} value={c.id}>{c.clave} · {c.nombre}</option>)}</select>
        <button className="boton" disabled={ocupado||!alumnoId||!conceptoId||!contexto.periodoAcademicoId||(cotizacion.modalidad==='BACHILLERATO'&&!segundoPeriodo)}>
          Autorizar programación sin emitir cargos</button>
      </fieldset>
    </form>}
    {plan&&<section aria-label="Cuotas autorizadas" aria-live="polite">
      <h3>Programación #{plan.id} · {pesos(plan.total)}</h3>
      <p>Alumno #{plan.alumnoId} · Plantel #{plan.plantelId} · Ciclo #{plan.cicloId}</p>
      <p>Antes de emitir una cuota, el alumno debe estar inscrito en el grupo regular de ese periodo y el ciclo debe estar activo. No es posible emitir dos cobros de colegiatura del mismo mes.</p>
      <div className="tabla-contenedor" role="region" aria-label="Cuotas de la programación" tabIndex={0}>
        <table className="tabla"><thead><tr><th>Concepto/cuota</th><th>Periodo</th><th>Vence</th><th>Monto</th><th>Emisión</th></tr></thead><tbody>
          {plan.cuotas.map(c=><tr key={c.numero}><td>{c.etiqueta}</td><td>{c.periodo}</td><td>{c.fechaVencimiento}</td><td>{pesos(c.monto)}</td>
            <td>{c.cargoId?<><span>Cargo #{c.cargoId}</span> <button type="button" disabled={ocupado} onClick={()=>void descargar(c.cargoId!)}>Ficha PDF</button></>:
              <button type="button" disabled={ocupado} onClick={()=>void emitir(c.numero)}>Emitir cargo</button>}</td></tr>)}
        </tbody></table>
      </div>
    </section>}
    {error&&<p role="alert" className="mensaje-error">{error}</p>}
    {mensaje&&<p role="status" className="mensaje-ok">{mensaje}</p>}
  </section>;
}
