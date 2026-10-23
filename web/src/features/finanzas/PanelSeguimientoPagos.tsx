import { FormEvent, useCallback, useEffect, useState } from 'react';
import { api, mensajeDeError } from '../../api/client';
import { Paginador } from '../../components/Paginador';
import { useConfirmacion } from '../../components/useConfirmacion';
import { SeguimientoCobranza } from '../../components/SeguimientoCobranza';
import { pesos } from '../../utils/formato';

interface Contacto {
  alumnoId: number; matricula: string; nombre: string; telefono: string | null; email: string | null;
  saldo: number; abonado: number; numeroCargos: number; primerVencimiento: string | null; vencidos: number;
}
interface Respuesta {
  datos: Contacto[]; total: number; pagina: number; porPagina: number; nota: string;
  resumen: { alumnosConSaldo: number; sinAbono: number; conAbonoParcial: number; vencidos: number };
}
interface Plantel { id: number; nombre: string }
const telefonoValido = (valor: string | null) => {
  if (!valor) return null;
  const digitos = valor.replace(/\D/g, '');
  if (digitos.length === 10) return `52${digitos}`;
  if (digitos.length === 12 && digitos.startsWith('52')) return digitos;
  return null;
};

export function PanelSeguimientoPagos() {
  const [planteles, setPlanteles] = useState<Plantel[]>([]);
  const [plantelId, setPlantelId] = useState(''), [pagina, setPagina] = useState(1);
  const [situacion, setSituacion] = useState<'TODOS'|'VENCIDOS'|'POR_VENCER'>('TODOS');
  const [sinAbono, setSinAbono] = useState(true), [datos, setDatos] = useState<Respuesta | null>(null);
  const [permitido, setPermitido] = useState(false);
  const [enviando, setEnviando] = useState(false), [cargando, setCargando] = useState(false), [error, setError] = useState(''), [mensaje, setMensaje] = useState('');
  const [revision, setRevision] = useState(0);
  const confirmacion = useConfirmacion();
  useEffect(() => {
    let activo = true;
    api.get<Plantel[]>('/planteles/mios').then(({data})=>{if(activo) setPlanteles(data);})
      .catch(e=>{if(activo)setError(mensajeDeError(e));});
    return ()=>{activo=false;};
  }, []);
  const cargar = useCallback(async () => {
    if (!plantelId) {setDatos(null);return;}
    setCargando(true);setError('');
    try {
      const {data} = await api.get<Respuesta>('/finanzas/cobranza/pendientes', {params:{
        plantelId:Number(plantelId), pagina, porPagina:10, situacion, sinAbono,
      }});
      setDatos(data);
    }catch(e){setError(mensajeDeError(e));}finally{setCargando(false);}
  },[plantelId,pagina,situacion,sinAbono]);
  useEffect(() => {void cargar();},[cargar,revision]);
  const avisar = async (e:FormEvent) => {
    e.preventDefault();if(enviando||!plantelId||!permitido)return;
    setError('');setMensaje('');setEnviando(true);
    try {
      const {data:previa}=await api.post<{registros:number;totalEstimado:number}>('/finanzas/preview-cobranza',{plantelId:Number(plantelId)});
      if (!previa.registros) {setMensaje('No existen cargos con saldo que requieran avisos en el plantel.');return;}
      const ok=await confirmacion.solicitar(`Se programarán avisos institucionales para ${previa.registros} cuentas con saldo, por correo SMTP, sobre ${pesos(previa.totalEstimado)}. La selección de filtros de pantalla no limita el lote: incluye TODOS los adeudos del plantel. ¿Confirmar?`);
      if(!ok)return;
      const {data} = await api.post<{programados:number;omitidos:number}>('/finanzas/avisos-cobranza',{plantelId:Number(plantelId),confirmado:true});
      setMensaje(`Avisos programados: ${data.programados}. Existentes: ${data.omitidos}. Programa no significa entregado; revisa el seguimiento.`);
      setRevision(n=>n+1);
    }catch(e){setError(mensajeDeError(e));}finally{setEnviando(false);}
  };
  return <section className="panel" aria-label="Seguimiento de pagos pendientes">
    {confirmacion.elemento}
    <h2>Seguimiento de alumnos con pagos pendientes</h2>
    <p>Consulta las cuentas con saldo. «Sin abono» significa que todavía no tienen pagos aplicados a sus cargos abiertos, aunque podrían tener pagos históricos.</p>
    <div className="fila">
      <div className="campo"><label htmlFor="seguimiento-plantel">Plantel</label>
        <select id="seguimiento-plantel" required value={plantelId} onChange={e=>{setPlantelId(e.target.value);setPagina(1);setPermitido(false);}}>
          <option value="">Selecciona plantel</option>{planteles.map(p=><option value={p.id} key={p.id}>{p.nombre}</option>)}
        </select>
      </div>
      <div className="campo"><label htmlFor="seguimiento-situacion">Estado de vencimiento</label>
        <select id="seguimiento-situacion" value={situacion} onChange={e=>{setSituacion(e.target.value as typeof situacion);setPagina(1);}}>
          <option value="TODOS">Todos con saldo</option><option value="VENCIDOS">Con cargos vencidos</option><option value="POR_VENCER">Sin cargos vencidos</option>
        </select>
      </div>
      <label><input type="checkbox" checked={sinAbono} onChange={e=>{setSinAbono(e.target.checked);setPagina(1);}}/> Solo sin abonos pendientes</label>
    </div>
    {cargando&&<p role="status">Consultando alumnos…</p>}
    {error&&<p role="alert">{error}<button type="button" onClick={()=>setRevision(v=>v+1)}>Reintentar</button></p>}
    {mensaje&&<p role="status">{mensaje}</p>}
    {datos&&<><div className="kpis">
      <article className="kpi"><p className="etiqueta">Alumnos con saldo</p><p className="valor">{datos.resumen.alumnosConSaldo}</p></article>
      <article className="kpi"><p className="etiqueta">Sin abono en cargos pendientes</p><p className="valor">{datos.resumen.sinAbono}</p></article>
      <article className="kpi"><p className="etiqueta">Con abono parcial</p><p className="valor">{datos.resumen.conAbonoParcial}</p></article>
      <article className="kpi"><p className="etiqueta">Con vencidos</p><p className="valor">{datos.resumen.vencidos}</p></article>
    </div>
    <div className="tabla-contenedor" role="region" tabIndex={0} aria-label="Alumnos con saldo pendiente">
      <table className="tabla"><thead><tr><th>Alumno</th><th>Saldo</th><th>Abonos en cargos abiertos</th><th>Vencimiento más próximo</th><th>Contacto</th></tr></thead>
      <tbody>{datos.datos.map(a=><tr key={a.alumnoId}>
        <td><strong>{a.matricula}</strong><br/>{a.nombre}<br/>{a.vencidos ? `${a.vencidos} cargo(s) vencido(s)` : 'Sin vencidos'}</td>
        <td className="monto">{pesos(a.saldo)}</td><td>{pesos(a.abonado)}</td><td>{a.primerVencimiento??'No registrada'}</td>
        <td><div className="acciones">
          {telefonoValido(a.telefono) && <><a href={`tel:+${telefonoValido(a.telefono)}`} aria-label={`Llamar al contacto registrado de ${a.matricula}`}>Llamar</a>
          <a target="_blank" rel="noopener noreferrer"
            href={`https://wa.me/${telefonoValido(a.telefono)}?text=${encodeURIComponent('Buen día. Le recordamos consultar el estado de cuenta escolar y la fecha de pago en su portal institucional. Para cualquier aclaración comuníquese con Finanzas.')}`}
            aria-label={`Preparar mensaje de WhatsApp para ${a.matricula}`}>WhatsApp</a></>}
          {a.email ? <span>Correo registrado</span>:<span>Sin correo registrado</span>}
          {!a.telefono&&<span>Sin teléfono registrado</span>}
        </div></td>
      </tr>)}
      {!datos.datos.length&&<tr><td colSpan={5}>No hay alumnos en este filtro.</td></tr>}</tbody></table>
    </div>
    <Paginador pagina={pagina} porPagina={10} total={datos.total} onCambio={setPagina} deshabilitado={cargando}/>
    <p className="texto-ayuda">{datos.nota}</p></>}
    <form className="panel" onSubmit={avisar}>
      <h3>Recordatorios por correo institucional</h3>
      <p>Los avisos se generan mediante la cola SMTP existente. El envío cubre todos los saldos del plantel, independientemente del filtro de la tabla. Requiere SMTP real y plantilla de cobranza.</p>
      <label><input type="checkbox" required checked={permitido} onChange={e=>setPermitido(e.target.checked)}/>
        Confirmo autorización institucional y aviso de privacidad vigente para contactar a las personas destinatarias.</label>
      <button className="boton" type="submit" disabled={!plantelId||enviando||!permitido}>{enviando?'Preparando…':'Previsualizar y programar correos'}</button>
      <p className="texto-ayuda">Las llamadas y WhatsApp son acciones individuales iniciadas por personal. El envío masivo automatizado por esos canales requiere un proveedor oficial, consentimiento comprobable y configuración adicional. No se realiza sin ello.</p>
    </form>
    <SeguimientoCobranza />
  </section>;
}
