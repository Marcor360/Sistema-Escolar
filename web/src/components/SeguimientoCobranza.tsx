import { useCallback, useEffect, useState } from 'react';
import { api, mensajeDeError } from '../api/client';
import { Paginador } from './Paginador';
import { useDialogoMotivo } from './useDialogoMotivo';
interface Envio { id: number; usuarioId: number; plantelId: number; saldo: number; estado: string; intentos: number; error: string | null }
export function SeguimientoCobranza() {
  const [datos, setDatos] = useState<Envio[]>([]), [pagina, setPagina] = useState(1), [total, setTotal] = useState(0), [error, setError] = useState(''), [cargando, setCargando] = useState(false);
  const dialogo = useDialogoMotivo();
  const cargar = useCallback(async (p: number) => { setCargando(true); setError(''); try { const { data } = await api.get('/finanzas/cobranza/envios', { params: { pagina: p } }); setDatos(data.datos); setTotal(data.total); setPagina(p); } catch (err) { setError(mensajeDeError(err)); } finally { setCargando(false); } }, []);
  useEffect(() => { void cargar(1); }, [cargar]);
  return <section className="panel">{dialogo.elemento}<h2>Seguimiento de cobranza</h2><p>Programado no significa enviado. Un resultado incierto requiere verificar el proveedor antes de reintentar; el correo podría haberse entregado.</p><button disabled={cargando} onClick={() => { void cargar(pagina); }}>Actualizar seguimiento</button>{error && <p role="alert">{error}</p>}
    <table className="tabla"><thead><tr><th>Envío / usuario / plantel</th><th>Saldo informado</th><th>Estado</th><th>Intentos</th><th>Resultado</th><th>Acción</th></tr></thead><tbody>{datos.map((d) => <tr key={d.id}><td>{d.id} / {d.usuarioId} / {d.plantelId}</td><td>{d.saldo}</td><td>{d.estado}</td><td>{d.intentos}</td><td>{d.error ?? 'Sin error'}</td><td>{['ERROR','INCIERTO'].includes(d.estado) && <button onClick={() => dialogo.abrir({ titulo: 'Reintentar correo de cobranza', advertencia: d.estado === 'INCIERTO' ? 'Verifica primero con el proveedor. Si ya fue entregado, reintentarlo puede duplicarlo.' : 'Se registrará el motivo y tu usuario.', ejecutar: async (motivo) => { await api.post(`/finanzas/cobranza/envios/${d.id}/reintento`, { motivo, confirmado: true }); await cargar(pagina); } })}>Reintentar con motivo</button>}</td></tr>)}</tbody></table>
    <Paginador pagina={pagina} porPagina={20} total={total} onCambio={(p) => { void cargar(p); }} /></section>;
}
