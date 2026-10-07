import { SeguimientoCobranza } from '../components/SeguimientoCobranza';
import { useDialogoMotivo } from '../components/useDialogoMotivo';
import { CatalogoConceptos } from '../components/CatalogoConceptos';
import { FormEvent, KeyboardEvent, useCallback, useEffect, useRef, useState } from 'react';
import { api, mensajeDeError } from '../api/client';
import { pesos, selloDeCargo } from '../utils/formato';
import { Conciliacion } from '../components/Conciliacion';
import { SelectorBuscable } from '../components/SelectorBuscable';
import { Encabezado } from '../components/Encabezado';
import { Paginador } from '../components/Paginador';

interface Alumno { id: number; matricula: string; usuario: { nombre: string; apellidoPaterno: string } }
interface Concepto { id: number; clave: string; nombre: string; tipo: string; montoBase: number }
interface Ciclo { id: number; clave: string }
interface Cargo {
  id: number; descripcion: string; periodo: string | null; monto: number; descuento: number;
  recargo: number; fechaVencimiento: string | null; estatus: string;
  alumno: Alumno;
}
interface Adeudo extends Cargo { total: number; pagado: number; saldo: number }
interface Pago {
  id: number; monto: number; metodo: string; referencia: string | null;
  fechaPago: string; estatus: string; alumno: Alumno;
}
interface ResultadoCargos { datos: Cargo[]; total: number; pagina: number; porPagina: number }
interface ResultadoPagos { datos: Pago[]; total: number; pagina: number; porPagina: number }


export default function FinanzasPage() {
  const dialogoMotivo = useDialogoMotivo();
  const [tab, setTab] = useState<'cargos' | 'pagos' | 'adeudos'>('cargos');
  const [conceptos, setConceptos] = useState<Concepto[]>([]);
  const [ciclos, setCiclos] = useState<Ciclo[]>([]);
  const [resultadoCargos, setResultadoCargos] = useState<ResultadoCargos>({ datos: [], total: 0, pagina: 1, porPagina: 20 });
  const [resultadoPagos, setResultadoPagos] = useState<ResultadoPagos>({ datos: [], total: 0, pagina: 1, porPagina: 20 });
  const [adeudos, setAdeudos] = useState<Adeudo[]>([]);
  const [paginaAdeudos, setPaginaAdeudos] = useState(1); const [totalAdeudos, setTotalAdeudos] = useState(0);
  const cargarAdeudos = async (pagina = 1) => {
    try { const { data } = await api.get('/finanzas/adeudos', { params: { pagina } }); setAdeudos(data.datos); setPaginaAdeudos(pagina); setTotalAdeudos(data.total); }
    catch (err) { setError(mensajeDeError(err)); }
  };
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [planteles, setPlanteles] = useState<{ id: number; nombre: string }[]>([]);
  const [plantelOperacion, setPlantelOperacion] = useState('');
  const confirmarMasiva = async (preview: string, datos: object) => {
    if (!plantelOperacion) throw new Error('Selecciona el plantel de la operación masiva');
    const { data } = await api.post(preview, { ...datos, plantelId: Number(plantelOperacion) });
    return confirm(`Plantel: ${planteles.find((p) => p.id === Number(plantelOperacion))?.nombre}\nCiclo: ${data.cicloId ?? 'Vigente / cargos existentes'}\nPeriodo: ${data.periodo ?? 'Cargos vencidos'}\nRegistros afectados: ${data.registros ?? data.generados ?? 0}\nTotal estimado: ${pesos(data.totalEstimado ?? 0)}\n¿Confirmar operación?`);
  };
  const corregir = (tipo: 'cargos' | 'pagos', id: number) => {
    dialogoMotivo.abrir({ titulo: tipo === 'cargos' ? 'Cancelar cargo' : 'Anular pago', advertencia: 'La operación conservará motivo, actor y fecha en la bitácora.', ejecutar: async (motivo) => {
      await api.post(`/finanzas/${tipo}/${id}/${tipo === 'cargos' ? 'cancelacion' : 'anulacion'}`, { motivo });
      setMensaje('Corrección registrada en la bitácora'); await cargarDatos();
    } });
  };

  const [formCargo, setFormCargo] = useState({ alumnoId: '', conceptoId: '', descripcion: '', monto: '', descuento: '0', fechaVencimiento: '' });
  const [formColegiaturas, setFormColegiaturas] = useState({ cicloId: '', periodo: '' });
  const [formPago, setFormPago] = useState({ alumnoId: '', cargoId: '', monto: '', metodo: 'EFECTIVO', referencia: '' });
  const intentoPago = useRef<{ firma: string; clave: string } | null>(null);
  const navegarTabs = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    const botones = Array.from(document.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
    const indice = botones.indexOf(event.currentTarget);
    const avance = event.key === 'ArrowRight' ? 1 : -1;
    const siguiente = botones[(indice + avance + botones.length) % botones.length];
    event.preventDefault();
    siguiente.focus();
    siguiente.click();
  };

  const cargarCatalogos = useCallback(async () => {
    try {
      const [conceptosR, ciclosR] = await Promise.all([
        api.get<Concepto[]>('/finanzas/conceptos'),
        api.get<Ciclo[]>('/academico/ciclos'),
      ]);
      setConceptos(conceptosR.data);
      setCiclos(ciclosR.data);
    } catch (err) { setError(mensajeDeError(err)); }
  }, []);
  const cargarCargos = useCallback(
    async (pagina = 1) => {
      try { const { data } = await api.get<ResultadoCargos>('/finanzas/cargos', { params: { pagina } }); setResultadoCargos(data); }
      catch (err) { setError(mensajeDeError(err)); }
    },
    [],
  );
  const cargarPagos = useCallback(
    async (pagina = 1) => {
      try { const { data } = await api.get<ResultadoPagos>('/finanzas/pagos', { params: { pagina } }); setResultadoPagos(data); }
      catch (err) { setError(mensajeDeError(err)); }
    },
    [],
  );
  const cargarDatos = useCallback(async () => {
    await Promise.all([cargarCargos(), cargarPagos()]);
    try { const { data } = await api.get('/finanzas/adeudos'); setAdeudos(data.datos); setPaginaAdeudos(1); setTotalAdeudos(data.total); }
    catch (err) { setError(mensajeDeError(err)); }
  }, [cargarCargos, cargarPagos]);
  useEffect(() => { cargarCatalogos(); cargarDatos(); api.get('/planteles/mios').then((r) => setPlanteles(r.data)).catch((e) => setError(mensajeDeError(e))); }, [cargarCatalogos, cargarDatos]);

  const limpiarAvisos = () => { setError(''); setMensaje(''); };

  const crearCargo = async (e: FormEvent) => {
    e.preventDefault();
    if (enviando) return; setEnviando(true);
    limpiarAvisos();
    try {
      await api.post('/finanzas/cargos', {
        alumnoId: Number(formCargo.alumnoId),
        conceptoId: Number(formCargo.conceptoId),
        descripcion: formCargo.descripcion,
        monto: Number(formCargo.monto), descuento: Number(formCargo.descuento),
        fechaVencimiento: formCargo.fechaVencimiento || undefined,
      });
      setFormCargo({ alumnoId: '', conceptoId: '', descripcion: '', monto: '', descuento: '0', fechaVencimiento: '' });
      setMensaje('Cargo registrado');
      cargarDatos();
    } catch (err) { setError(mensajeDeError(err)); } finally { setEnviando(false); }
  };

  const generarColegiaturas = async (e: FormEvent) => {
    e.preventDefault();
    if (enviando) return; setEnviando(true);
    limpiarAvisos();
    try {
      if (!await confirmarMasiva('/finanzas/cargos/preview-colegiaturas', { cicloId: Number(formColegiaturas.cicloId), periodo: formColegiaturas.periodo })) return;
      const { data } = await api.post('/finanzas/cargos/generar-colegiaturas', {
        plantelId: Number(plantelOperacion), confirmado: true,
        cicloId: Number(formColegiaturas.cicloId),
        periodo: formColegiaturas.periodo,
      });
      setMensaje(`Colegiaturas: ${data.generados} generadas, ${data.omitidos} ya existían (vencen ${data.vencimiento})`);
      cargarDatos();
    } catch (err) { setError(mensajeDeError(err)); } finally { setEnviando(false); }
  };

  const aplicarRecargos = async () => {
    if (enviando) return; setEnviando(true);
    limpiarAvisos();
    try {
      if (!await confirmarMasiva('/finanzas/cargos/preview-recargos', {})) return;
      const { data } = await api.post('/finanzas/cargos/aplicar-recargos', { plantelId: Number(plantelOperacion), confirmado: true });
      setMensaje(`Recargos del ${data.porcentaje}% aplicados a ${data.aplicados} cargos vencidos`);
      cargarDatos();
    } catch (err) { setError(mensajeDeError(err)); } finally { setEnviando(false); }
  };

  const registrarPago = async (e: FormEvent) => {
    e.preventDefault();
    if (enviando) return; setEnviando(true);
    limpiarAvisos();
    const datos = {
      alumnoId: Number(formPago.alumnoId),
      cargoId: formPago.cargoId ? Number(formPago.cargoId) : undefined,
      monto: Number(formPago.monto),
      metodo: formPago.metodo,
      referencia: formPago.referencia || undefined,
    };
    const firma = JSON.stringify(datos);
    if (intentoPago.current?.firma !== firma) {
      intentoPago.current = { firma, clave: crypto.randomUUID() };
    }
    try {
      await api.post('/finanzas/pagos', {
        ...datos,
        claveIdempotencia: intentoPago.current.clave,
      });
      intentoPago.current = null;
      setFormPago({ alumnoId: '', cargoId: '', monto: '', metodo: 'EFECTIVO', referencia: '' });
      setMensaje('Pago registrado y estado de cuenta actualizado');
      cargarDatos();
    } catch (err) { setError(mensajeDeError(err)); } finally { setEnviando(false); }
  };

  const enviarAvisos = async () => {
    if (enviando) return; setEnviando(true);
    limpiarAvisos();
    try {
      if (!await confirmarMasiva('/finanzas/preview-cobranza', {})) return;
      const { data } = await api.post('/finanzas/avisos-cobranza', { plantelId: Number(plantelOperacion), confirmado: true });
      setMensaje(`Avisos programados: ${data.programados}; ya registrados: ${data.omitidos}. Consulta el seguimiento de envíos.`);
    } catch (err) { setError(mensajeDeError(err)); } finally { setEnviando(false); }
  };

  const descargarExcel = async () => {
    if (enviando) return; setEnviando(true);
    limpiarAvisos();
    try {
      const { data } = await api.get('/reportes/adeudos.xlsx', { responseType: 'blob' });
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'adeudos.xlsx';
      a.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) { setError(mensajeDeError(err)); } finally { setEnviando(false); }
  };

  return (
    <>{dialogoMotivo.elemento}
      <Encabezado titulo="Finanzas" detalle="Cargos, pagos, adeudos y cobranza" />
      <CatalogoConceptos cambiado={() => { void cargarCatalogos(); }} />

      <div className="tabs" role="tablist" aria-label="Secciones de finanzas">
        <button id="tab-cargos" role="tab" aria-selected={tab === 'cargos'} aria-controls="panel-cargos" tabIndex={tab === 'cargos' ? 0 : -1} className={tab === 'cargos' ? 'activa' : ''} onKeyDown={navegarTabs} onClick={() => setTab('cargos')}>Cargos</button>
        <button id="tab-pagos" role="tab" aria-selected={tab === 'pagos'} aria-controls="panel-pagos" tabIndex={tab === 'pagos' ? 0 : -1} className={tab === 'pagos' ? 'activa' : ''} onKeyDown={navegarTabs} onClick={() => setTab('pagos')}>Pagos</button>
        <button id="tab-adeudos" role="tab" aria-selected={tab === 'adeudos'} aria-controls="panel-adeudos" tabIndex={tab === 'adeudos' ? 0 : -1} className={tab === 'adeudos' ? 'activa' : ''} onKeyDown={navegarTabs} onClick={() => setTab('adeudos')}>Adeudos y cobranza</button>
      </div>

      {error && <p className="mensaje-error" role="alert">{error}</p>}
      {mensaje && <p className="mensaje-ok" role="status">{mensaje}</p>}

      <Conciliacion />
      <section className="panel"><label htmlFor="plantel-operacion">Plantel para operaciones masivas</label>
        <select id="plantel-operacion" value={plantelOperacion} onChange={(e) => setPlantelOperacion(e.target.value)}><option value="">Selecciona un plantel…</option>{planteles.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}</select>
        <p>Las colegiaturas, recargos y avisos requieren previsualización y confirmación para este plantel.</p>
      </section>
      {tab === 'cargos' && (
        <div id="panel-cargos" role="tabpanel" aria-labelledby="tab-cargos" tabIndex={0}>
          <section className="panel">
            <h2>Nuevo cargo individual</h2>
            <form onSubmit={crearCargo} className="fila">
              <SelectorBuscable<Alumno> ruta="/finanzas/alumnos" valor={formCargo.alumnoId} cambiar={(id) => setFormCargo({ ...formCargo, alumnoId: id })} etiqueta="Alumno" texto={(a) => `${a.matricula} — ${a.usuario.nombre} ${a.usuario.apellidoPaterno}`} />
              <div className="campo"><label htmlFor="finanzas-campo-1">Concepto</label>
                <select id="finanzas-campo-1"
                  required value={formCargo.conceptoId}
                  onChange={(e) => {
                    const concepto = conceptos.find((c) => c.id === Number(e.target.value));
                    setFormCargo({
                      ...formCargo,
                      conceptoId: e.target.value,
                      descripcion: concepto?.nombre ?? formCargo.descripcion,
                      monto: concepto && concepto.montoBase > 0 ? String(concepto.montoBase) : formCargo.monto,
                    });
                  }}
                >
                  <option value="">Selecciona…</option>
                  {conceptos.filter((c) => !['BECA', 'DESCUENTO', 'RECARGO'].includes(c.tipo)).map((c) => <option key={c.id} value={c.id}>{c.clave} — {c.nombre}</option>)}
                </select>
              </div>
              <div className="campo"><label htmlFor="finanzas-campo-2">Descripción</label>
                <input id="finanzas-campo-2" required value={formCargo.descripcion} onChange={(e) => setFormCargo({ ...formCargo, descripcion: e.target.value })} />
              </div>
              <div className="campo"><label htmlFor="finanzas-campo-3">Monto</label>
                <input id="finanzas-campo-3" type="number" min={0} step={0.01} required value={formCargo.monto} onChange={(e) => setFormCargo({ ...formCargo, monto: e.target.value })} />
              </div>
              <div className="campo"><label htmlFor="descuento-cargo">Beca / descuento</label><input id="descuento-cargo" type="number" min={0} max={formCargo.monto || undefined} step="0.01" value={formCargo.descuento} onChange={(e) => setFormCargo({ ...formCargo, descuento: e.target.value })} /></div><div className="campo"><label htmlFor="finanzas-campo-4">Vence</label>
                <input id="finanzas-campo-4" type="date" value={formCargo.fechaVencimiento} onChange={(e) => setFormCargo({ ...formCargo, fechaVencimiento: e.target.value })} />
              </div>
              <button disabled={enviando} className="boton">Registrar cargo</button>
            </form>
          </section>

          <section className="panel">
            <h2>Generar colegiaturas del periodo</h2>
            <form onSubmit={generarColegiaturas} className="fila">
              <div className="campo"><label htmlFor="finanzas-campo-5">Ciclo</label>
                <select id="finanzas-campo-5" required value={formColegiaturas.cicloId} onChange={(e) => setFormColegiaturas({ ...formColegiaturas, cicloId: e.target.value })}>
                  <option value="">Selecciona…</option>
                  {ciclos.map((c) => <option key={c.id} value={c.id}>{c.clave}</option>)}
                </select>
              </div>
              <div className="campo"><label htmlFor="finanzas-campo-6">Periodo (AAAA-MM)</label>
                <input id="finanzas-campo-6" required pattern="\d{4}-\d{2}" placeholder="2026-09" value={formColegiaturas.periodo}
                  onChange={(e) => setFormColegiaturas({ ...formColegiaturas, periodo: e.target.value })} />
              </div>
              <button disabled={enviando} className="boton">Generar para inscritos</button>
              <button type="button" className="boton secundario" onClick={aplicarRecargos}>Aplicar recargos a vencidos</button>
            </form>
          </section>

          <table className="tabla">
            <thead><tr><th>Alumno</th><th>Descripción</th><th>Periodo</th><th>Vence</th><th className="derecha">Monto</th><th className="derecha">Recargo</th><th>Estatus</th><th>Correcciones</th></tr></thead>
            <tbody>
              {resultadoCargos.datos.map((c) => (
                <tr key={c.id}>
                  <td>{c.alumno.matricula}</td>
                  <td>{c.descripcion}</td>
                  <td>{c.periodo ?? '—'}</td>
                  <td>{c.fechaVencimiento ?? '—'}</td>
                  <td className="derecha monto">{pesos(c.monto - c.descuento)}</td>
                  <td className="derecha monto">{c.recargo > 0 ? pesos(c.recargo) : '—'}</td>
                  <td><span className={`sello ${selloDeCargo(c.estatus)}`}>{c.estatus}</span></td><td>{c.estatus !== 'CANCELADO' && <button disabled={enviando} onClick={() => corregir('cargos', c.id)}>Cancelar cargo</button>}</td>
                </tr>
              ))}
              {resultadoCargos.datos.length === 0 && <tr><td className="vacio" colSpan={7}>Sin cargos registrados.</td></tr>}
            </tbody>
          </table>
          <Paginador total={resultadoCargos.total} pagina={resultadoCargos.pagina} porPagina={resultadoCargos.porPagina} onCambio={cargarCargos} />
        </div>
      )}

      {tab === 'pagos' && (
        <div id="panel-pagos" role="tabpanel" aria-labelledby="tab-pagos" tabIndex={0}>
          <section className="panel">
            <h2>Registrar pago manual</h2>
            <form onSubmit={registrarPago} className="fila">
              <SelectorBuscable<Alumno> ruta="/finanzas/alumnos" valor={formPago.alumnoId} cambiar={(id) => setFormPago({ ...formPago, alumnoId: id, cargoId: '' })} etiqueta="Alumno" texto={(a) => `${a.matricula} — ${a.usuario.nombre} ${a.usuario.apellidoPaterno}`} />
              <SelectorBuscable<Cargo> ruta="/finanzas/cargos" valor={formPago.cargoId} cambiar={(id) => setFormPago({ ...formPago, cargoId: id })}
                etiqueta="Cargo" deshabilitado={!formPago.alumnoId} filtros={{ alumnoId: Number(formPago.alumnoId) || undefined }} texto={(c) => `${c.descripcion} — ${pesos(c.monto - c.descuento + c.recargo)} · ${c.estatus}`} />
              <div className="campo"><label htmlFor="finanzas-campo-7">Monto</label>
                <input id="finanzas-campo-7" type="number" min={0.01} step={0.01} required value={formPago.monto} onChange={(e) => setFormPago({ ...formPago, monto: e.target.value })} />
              </div>
              <div className="campo"><label htmlFor="finanzas-campo-8">Método</label>
                <select id="finanzas-campo-8" value={formPago.metodo} onChange={(e) => setFormPago({ ...formPago, metodo: e.target.value })}>
                  <option>EFECTIVO</option><option>TRANSFERENCIA</option><option>TARJETA</option>
                </select>
              </div>
              <div className="campo"><label htmlFor="finanzas-campo-9">Referencia</label>
                <input id="finanzas-campo-9" value={formPago.referencia} onChange={(e) => setFormPago({ ...formPago, referencia: e.target.value })} />
              </div>
              <button disabled={enviando} className="boton">Registrar pago</button>
            </form>
          </section>

          <table className="tabla">
            <thead><tr><th>Fecha</th><th>Alumno</th><th className="derecha">Monto</th><th>Método</th><th>Referencia</th><th>Estatus</th><th>Correcciones</th></tr></thead>
            <tbody>
              {resultadoPagos.datos.map((p) => (
                <tr key={p.id}>
                  <td>{new Date(p.fechaPago).toLocaleString('es-MX')}</td>
                  <td>{p.alumno.matricula} — {p.alumno.usuario.nombre} {p.alumno.usuario.apellidoPaterno}</td>
                  <td className="derecha monto">{pesos(p.monto)}</td>
                  <td>{p.metodo}</td>
                  <td>{p.referencia ?? '—'}</td>
                  <td><span className={`sello ${p.estatus === 'CONFIRMADO' ? 'ok' : 'aviso'}`}>{p.estatus}</span></td><td>{p.estatus === 'CONFIRMADO' && p.metodo !== 'PASARELA' && <button disabled={enviando} onClick={() => corregir('pagos', p.id)}>Anular pago</button>}</td>
                </tr>
              ))}
              {resultadoPagos.datos.length === 0 && <tr><td className="vacio" colSpan={6}>Sin pagos registrados.</td></tr>}
            </tbody>
          </table>
          <Paginador total={resultadoPagos.total} pagina={resultadoPagos.pagina} porPagina={resultadoPagos.porPagina} onCambio={cargarPagos} />
        </div>
      )}

      {tab === 'adeudos' && (
        <div id="panel-adeudos" role="tabpanel" aria-labelledby="tab-adeudos" tabIndex={0}>
          <div className="acciones" style={{ marginBottom: 14 }}>
            <button disabled={enviando} className="boton" onClick={enviarAvisos}>Programar avisos de cobranza</button>
            <button className="boton secundario" onClick={descargarExcel}>Descargar Excel de adeudos</button>
          </div>
          <table className="tabla">
            <thead><tr><th>Alumno</th><th>Concepto</th><th>Vence</th><th className="derecha">Total</th><th className="derecha">Pagado</th><th className="derecha">Saldo</th><th>Estatus</th><th>Correcciones</th></tr></thead>
            <tbody>
              {adeudos.map((c) => (
                <tr key={c.id}>
                  <td>{c.alumno.matricula} — {c.alumno.usuario.nombre} {c.alumno.usuario.apellidoPaterno}</td>
                  <td>{c.descripcion}</td>
                  <td>{c.fechaVencimiento ?? '—'}</td>
                  <td className="derecha monto">{pesos(c.total)}</td>
                  <td className="derecha monto">{pesos(c.pagado)}</td>
                  <td className="derecha monto"><b>{pesos(c.saldo)}</b></td>
                  <td><span className={`sello ${selloDeCargo(c.estatus)}`}>{c.estatus}</span></td><td>{c.estatus !== 'CANCELADO' && <button disabled={enviando} onClick={() => corregir('cargos', c.id)}>Cancelar cargo</button>}</td>
                </tr>
              ))}
              {adeudos.length === 0 && <tr><td className="vacio" colSpan={7}>Sin adeudos: todos los cargos están cubiertos.</td></tr>}
            </tbody>
          </table>
          <SeguimientoCobranza /><Paginador total={totalAdeudos} pagina={paginaAdeudos} porPagina={20} onCambio={cargarAdeudos} />
        </div>
      )}
    </>
  );
}
