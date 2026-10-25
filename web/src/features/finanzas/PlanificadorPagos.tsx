import { ConfirmarProgramacion, type DatosCotizados } from './ConfirmarProgramacion';
import { FormEvent, useState } from 'react';
import { api, mensajeDeError } from '../../api/client';
import { pesos } from '../../utils/formato';

type Modalidad = 'SECUNDARIA' | 'BACHILLERATO' | 'SUPERIOR' | 'ADICIONAL';
type Cuota = { numero: number; periodo: string; fechaVencimiento: string; monto: number; etiqueta: string };
interface Cotizacion { modalidad: Modalidad; total: number; cuotas: Cuota[]; advertencia: string }
const modalidades: { valor: Modalidad; etiqueta: string; descripcion: string }[] = [
  { valor:'SECUNDARIA', etiqueta:'Secundaria — anualidad', descripcion:'Captura el total del año escolar; una cuota anual.' },
  { valor:'BACHILLERATO', etiqueta:'Bachillerato — año escolar', descripcion:'Captura el total anual; se proponen dos semestres editables que deben sumar el total.' },
  { valor:'SUPERIOR', etiqueta:'Licenciatura, especialidad, maestría o doctorado — cuatrimestre', descripcion:'Captura el total del cuatrimestre; se proponen cuatro mensualidades.' },
  { valor:'ADICIONAL', etiqueta:'Concepto adicional', descripcion:'Primero autoriza su total; después elige pago único o de 2 a 12 parcialidades.' },
];
export function PlanificadorPagos() {
  const [modalidad, setModalidad] = useState<Modalidad>('SECUNDARIA');
  const [total, setTotal] = useState('');
  const [mesInicio, setMesInicio] = useState('');
  const [diaVencimiento, setDiaVencimiento] = useState('5');
  const [numeroCuotas, setNumeroCuotas] = useState('1');
  const [primerSemestre, setPrimerSemestre] = useState('');
  const [segundoSemestre, setSegundoSemestre] = useState('');
  const [personalizar, setPersonalizar] = useState(false);
  const [cotizacion, setCotizacion] = useState<Cotizacion | null>(null);
  const [datosCotizados, setDatosCotizados] = useState<DatosCotizados | null>(null);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);
  const descripcion = modalidades.find(m => m.valor === modalidad)?.descripcion ?? '';
  const limpiar = () => { setCotizacion(null); setDatosCotizados(null); setError(''); };
  const cambiarModalidad = (valor: Modalidad) => { setModalidad(valor); setPersonalizar(false); setPrimerSemestre(''); setSegundoSemestre(''); limpiar(); };
  const enviar = async (e: FormEvent) => {
    e.preventDefault(); if (cargando) return;
    setCargando(true); limpiar();
    const datos = {
      modalidad, total: Number(total), mesInicio, diaVencimiento: Number(diaVencimiento),
      ...(modalidad === 'ADICIONAL' ? { numeroCuotas: Number(numeroCuotas) } : {}),
      ...(modalidad === 'BACHILLERATO' && personalizar ? { importes: [Number(primerSemestre), Number(segundoSemestre)] } : {}),
    };
    try { const { data } = await api.post<Cotizacion>('/finanzas/programaciones/previsualizar', datos); setCotizacion(data); setDatosCotizados(datos); }
    catch(err) { setError(mensajeDeError(err)); }
    finally { setCargando(false); }
  };
  return <section className="panel">
    <h2>Programar importes por periodo académico</h2>
    <p>Este módulo calcula una propuesta antes de abrir cartera. <strong>No crea cargos, pagos ni inscripciones</strong>. Los importes y plazos deben autorizarse antes de emitir fichas.</p>
    <form onSubmit={enviar} aria-busy={cargando}>
      <div className="fila">
        <div className="campo"><label htmlFor="programacion-modalidad">Nivel y periodicidad</label>
          <select id="programacion-modalidad" value={modalidad} onChange={e=>cambiarModalidad(e.target.value as Modalidad)}>
            {modalidades.map(m=><option key={m.valor} value={m.valor}>{m.etiqueta}</option>)}
          </select><small>{descripcion}</small></div>
        <div className="campo"><label htmlFor="programacion-total">{modalidad==='SUPERIOR'?'Total del cuatrimestre':modalidad==='ADICIONAL'?'Total del concepto':'Total del año escolar'} (MXN)</label>
          <input required id="programacion-total" type="number" min="0.01" step="0.01" value={total} onChange={e=>{setTotal(e.target.value);limpiar();}} /></div>
        <div className="campo"><label htmlFor="programacion-inicio">Mes del primer pago</label>
          <input required id="programacion-inicio" type="month" value={mesInicio} onChange={e=>{setMesInicio(e.target.value);limpiar();}} /></div>
        <div className="campo"><label htmlFor="programacion-dia">Día de vencimiento (1–28)</label>
          <input required id="programacion-dia" type="number" min="1" max="28" step="1" value={diaVencimiento} onChange={e=>{setDiaVencimiento(e.target.value);limpiar();}} /></div>
      </div>
      {modalidad==='BACHILLERATO'&&<fieldset><legend>Importes por semestre</legend><label><input type="checkbox" checked={personalizar} onChange={e=>{setPersonalizar(e.target.checked);limpiar();}}/>Modificar importes por separado</label>
        {personalizar&&<div className="fila"><div className="campo"><label htmlFor="programacion-sem1">Primer semestre (MXN)</label><input id="programacion-sem1" required type="number" min="0.01" step="0.01" value={primerSemestre} onChange={e=>{setPrimerSemestre(e.target.value);limpiar();}}/></div>
          <div className="campo"><label htmlFor="programacion-sem2">Segundo semestre (MXN)</label><input id="programacion-sem2" required type="number" min="0.01" step="0.01" value={segundoSemestre} onChange={e=>{setSegundoSemestre(e.target.value);limpiar();}}/></div></div>}
      </fieldset>}
      {modalidad==='ADICIONAL'&&<div className="campo"><label htmlFor="programacion-cuotas">Número de pagos</label>
        <select id="programacion-cuotas" value={numeroCuotas} onChange={e=>{setNumeroCuotas(e.target.value);limpiar();}}>{Array.from({length:12},(_,i)=>i+1).map(n=><option key={n} value={n}>{n===1?'Una sola exhibición':n+' mensualidades'}</option>)}</select>
      </div>}
      <button type="submit" disabled={cargando} className="boton">{cargando?'Calculando…':'Previsualizar importes'}</button>
    </form>
    {error&&<p role="alert" className="mensaje-error">{error}</p>}
    {cotizacion&&<section aria-label="Distribución de cuotas" role="status">
      <h3>Importe total: {pesos(cotizacion.total)}</h3>
      <div className="tabla-contenedor" tabIndex={0} role="region" aria-label="Cuotas calculadas">
        <table className="tabla"><thead><tr><th>Pago</th><th>Periodo</th><th>Vencimiento</th><th>Importe</th></tr></thead><tbody>
          {cotizacion.cuotas.map(c=><tr key={c.numero}><td>{c.etiqueta}</td><td>{c.periodo}</td><td>{c.fechaVencimiento}</td><td>{pesos(c.monto)}</td></tr>)}
        </tbody></table>
      </div><p className="texto-ayuda">{cotizacion.advertencia}</p>
    </section>}
    {cotizacion&&datosCotizados&&<ConfirmarProgramacion key={JSON.stringify(datosCotizados)} cotizacion={datosCotizados} />}
  </section>;
}
