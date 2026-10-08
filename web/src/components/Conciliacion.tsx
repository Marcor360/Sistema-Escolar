import { useConfirmacion } from './useConfirmacion';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { api, mensajeDeError } from '../api/client';
import { pesos } from '../utils/formato';
import { Paginador } from './Paginador';
import { SelectorBuscable } from './SelectorBuscable';

interface Incidencia { id: number; alumnoId: number; matricula: string; monto: number; fecha: string; referencia: string; motivo: string; estatus: string }
interface Cargo { id: number; descripcion: string; estatus: string }
interface Auditoria { id: number; usuarioId: number; accion: string; entidadId: number; detalle: string; createdAt: string }

export function Conciliacion() {
  const confirmacion = useConfirmacion();
  const [tipo, setTipo] = useState<'ordenes' | 'pagos'>('ordenes'); const [pagina, setPagina] = useState(1);
  const [resultado, setResultado] = useState<{ datos: Incidencia[]; total: number }>({ datos: [], total: 0 });
  const [seleccion, setSeleccion] = useState<Incidencia | null>(null); const [cargoId, setCargoId] = useState('');
  const [motivo, setMotivo] = useState(''); const [error, setError] = useState(''); const [mensaje, setMensaje] = useState('');
  const [enviando, setEnviando] = useState(false); const [auditoria, setAuditoria] = useState<Auditoria[]>([]);
  const cargar = useCallback(async () => {
    try { const { data } = await api.get(`/finanzas/conciliacion/${tipo}`, { params: { pagina } }); setResultado(data);
      const log = await api.get<Auditoria[]>('/finanzas/bitacora'); setAuditoria(log.data.filter((a) => a.accion.startsWith('CONCILIAR_')));
    } catch (err) { setError(mensajeDeError(err)); }
  }, [tipo, pagina]);
  useEffect(() => { void cargar(); }, [cargar]);
  const resolver = async (e: FormEvent) => {
    e.preventDefault(); if (!seleccion || enviando || !await confirmacion.solicitar('¿Confirmar la conciliación? Se registrará tu usuario, la fecha y el motivo.')) return;
    setEnviando(true); setError('');
    try { await api.post(`/finanzas/${tipo}/${seleccion.id}/${tipo === 'ordenes' ? 'conciliacion' : 'aplicacion'}`,
      { motivo, ...(tipo === 'pagos' ? { cargoId: Number(cargoId) } : {}) });
      setMensaje('Resultado verificado y registrado en la bitácora'); setSeleccion(null); setMotivo(''); setCargoId(''); await cargar();
    } catch (err) { setError(mensajeDeError(err)); } finally { setEnviando(false); }
  };
  return <>{confirmacion.elemento}<section className="panel"><h2>Conciliación financiera</h2><p>Las órdenes se verifican con el proveedor. El dinero confirmado sin aplicación se asigna a un cargo del mismo alumno.</p>
    <label htmlFor="tipo-incidencia">Incidencias</label><select id="tipo-incidencia" value={tipo} onChange={(e) => { setTipo(e.target.value as typeof tipo); setPagina(1); setSeleccion(null); }}>
      <option value="ordenes">Órdenes ambiguas o pendientes</option><option value="pagos">Pagos confirmados no aplicados</option></select>
    {error && <p role="alert" className="mensaje-error">{error}</p>}{mensaje && <p role="status" className="mensaje-ok">{mensaje}</p>}
    <table className="tabla"><thead><tr><th>Referencia</th><th>Alumno</th><th>Monto</th><th>Fecha</th><th>Estado / motivo</th><th>Resolución</th></tr></thead><tbody>
      {resultado.datos.map((i) => <tr key={i.id}><td>{i.referencia}</td><td>{i.matricula}</td><td>{pesos(i.monto)}</td><td>{new Date(i.fecha).toLocaleString('es-MX')}</td><td>{i.estatus} · {i.motivo}</td>
        <td><button disabled={enviando} onClick={() => { setSeleccion(i); setMotivo(''); setCargoId(''); }}>Revisar</button></td></tr>)}
      {!resultado.datos.length && <tr><td colSpan={6}>Sin incidencias pendientes.</td></tr>}
    </tbody></table><Paginador total={resultado.total} pagina={pagina} porPagina={20} onCambio={setPagina} />
    {seleccion && <form onSubmit={resolver}><h3>Resolver {seleccion.referencia}</h3>
      {tipo === 'pagos' && <SelectorBuscable<Cargo> ruta="/finanzas/cargos" valor={cargoId} cambiar={setCargoId} etiqueta="Cargo de destino"
        filtros={{ alumnoId: seleccion.alumnoId }} texto={(c) => `${c.descripcion} · ${c.estatus}`} />}
      <label htmlFor="motivo-conciliacion">Motivo de resolución</label><input id="motivo-conciliacion" required minLength={3} maxLength={400} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
      <button disabled={enviando}>{enviando ? 'Verificando…' : tipo === 'ordenes' ? 'Verificar con Openpay' : 'Aplicar pago'}</button><button type="button" onClick={() => setSeleccion(null)}>Cancelar</button>
    </form>}
    <h3>Resoluciones auditadas</h3>{auditoria.slice(0, 20).map((a) => <p key={a.id}>{new Date(a.createdAt).toLocaleString('es-MX')} · Actor {a.usuarioId} · {a.accion} #{a.entidadId} · {a.detalle}</p>)}
  </section></>;
}
