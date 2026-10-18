import { useModuloTrabajo } from '../components/ModuloTrabajo';
import { useConfirmacion } from '../components/useConfirmacion';
import { PanelCargos } from '../features/finanzas/PanelCargos';
import { PanelPagos } from '../features/finanzas/PanelPagos';
import { PanelAdeudos } from '../features/finanzas/PanelAdeudos';
import type { Concepto, Ciclo, Adeudo, ResultadoCargos, ResultadoPagos } from '../features/finanzas/tipos';

import { useDialogoMotivo } from '../components/useDialogoMotivo';
import { CatalogoConceptos } from '../components/CatalogoConceptos';
import { FormEvent, KeyboardEvent, useCallback, useEffect, useRef, useState } from 'react';
import { api, mensajeDeError } from '../api/client';
import { pesos } from '../utils/formato';
import { Conciliacion } from '../components/Conciliacion';

import { Encabezado } from '../components/Encabezado';

export default function FinanzasPage() {
  const confirmacion = useConfirmacion();
  const dialogoMotivo = useDialogoMotivo();
  const [tabLegado, setTab] = useState<'cargos' | 'pagos' | 'adeudos'>('cargos');
  const [conceptos, setConceptos] = useState<Concepto[]>([]);
  const [ciclos, setCiclos] = useState<Ciclo[]>([]);
  const [resultadoCargos, setResultadoCargos] = useState<ResultadoCargos>({ datos: [], total: 0, pagina: 1, porPagina: 10 });
  const [resultadoPagos, setResultadoPagos] = useState<ResultadoPagos>({ datos: [], total: 0, pagina: 1, porPagina: 10 });
  const [adeudos, setAdeudos] = useState<Adeudo[]>([]);
  const [paginaAdeudos, setPaginaAdeudos] = useState(1); const [totalAdeudos, setTotalAdeudos] = useState(0);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [enviando, setEnviando] = useState(false);
  const trabajo = useModuloTrabajo(enviando), modo = trabajo.modo, legado = modo === 'legado';
  const tab = legado ? tabLegado : modo === 'pago-nuevo' ? 'pagos' : modo === 'cargo-nuevo' || modo === 'colegiaturas' ? 'cargos' : modo as 'cargos' | 'pagos' | 'adeudos';
  const listado = legado || ['cargos', 'pagos', 'adeudos'].includes(modo);
  const pagina = Math.max(1, Number(trabajo.query.get('pagina')) || 1);
  const [planteles, setPlanteles] = useState<{ id: number; nombre: string }[]>([]);
  const [plantelOperacion, setPlantelOperacion] = useState('');
  const confirmarMasiva = async (preview: string, datos: object) => {
    if (!plantelOperacion) throw new Error('Selecciona el plantel de la operación masiva');
    const { data } = await api.post(preview, { ...datos, plantelId: Number(plantelOperacion) });
    return await confirmacion.solicitar(`Plantel: ${planteles.find((p) => p.id === Number(plantelOperacion))?.nombre}\nCiclo: ${data.cicloId ?? 'Vigente / cargos existentes'}\nPeriodo: ${data.periodo ?? 'Cargos vencidos'}\nRegistros afectados: ${data.registros ?? data.generados ?? 0}\nTotal estimado: ${pesos(data.totalEstimado ?? 0)}\n¿Confirmar operación?`);
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
  const [cargando, setCargando] = useState(false);
  const tabActual = useRef(tab); tabActual.current = tab;
  const consultas = useRef({ cargos: 0, pagos: 0, adeudos: 0 });
  const cargarColeccion = useCallback(async (tipo: 'cargos' | 'pagos' | 'adeudos', pagina = 1) => {
    const consulta = ++consultas.current[tipo];
    if (tabActual.current === tipo) { setCargando(true); setError(''); }
    try {
      const { data } = await api.get(`/finanzas/${tipo}`, { params: { pagina, porPagina: 10 } });
      if (consultas.current[tipo] !== consulta || tabActual.current !== tipo) return;
      if (tipo === 'cargos') setResultadoCargos(data);
      else if (tipo === 'pagos') setResultadoPagos(data);
      else { setAdeudos(data.datos); setPaginaAdeudos(pagina); setTotalAdeudos(data.total); }
    } catch (err) {
      if (consultas.current[tipo] === consulta && tabActual.current === tipo) setError(mensajeDeError(err));
    } finally {
      if (consultas.current[tipo] === consulta && tabActual.current === tipo) setCargando(false);
    }
  }, []);
  const cargarCargos = useCallback((pagina = 1) => cargarColeccion('cargos', pagina), [cargarColeccion]);
  const cargarPagos = useCallback((pagina = 1) => cargarColeccion('pagos', pagina), [cargarColeccion]);
  const cargarAdeudos = useCallback((pagina = 1) => cargarColeccion('adeudos', pagina), [cargarColeccion]);
  // Tras una operación consulta el panel que está visible al terminar, aunque se haya cambiado de pestaña.
  const cargarDatos = useCallback(() => listado ? cargarColeccion(tabActual.current, pagina) : Promise.resolve(), [cargarColeccion, listado, pagina]);
  useEffect(() => {
    if (legado || ['cargo-nuevo','colegiaturas'].includes(modo)) void cargarCatalogos();
    if (legado || ['colegiaturas', 'adeudos'].includes(modo)) api.get('/planteles/mios').then(r => setPlanteles(r.data)).catch(e => setError(mensajeDeError(e)));
  }, [cargarCatalogos, legado, modo]);
  useEffect(() => { if (listado) void cargarColeccion(tab, pagina); return () => { consultas.current.cargos++; consultas.current.pagos++; consultas.current.adeudos++; }; }, [tab, cargarColeccion, listado, pagina]);
  useEffect(() => () => {
    consultas.current.cargos++; consultas.current.pagos++; consultas.current.adeudos++;
  }, []);

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
      trabajo.guardado(); if (!legado) trabajo.ir('cargos');
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
      trabajo.guardado(); if (!legado) trabajo.ir('cargos');
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
      trabajo.guardado(); if (!legado) trabajo.ir('pagos');
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
    <>{confirmacion.elemento}{dialogoMotivo.elemento}
      <Encabezado titulo="Finanzas" detalle="Cargos, pagos, adeudos y cobranza" />
      {(legado || modo === 'conceptos') && <CatalogoConceptos cambiado={() => { void cargarCatalogos(); }} />}

      {legado && <div className="tabs" role="tablist" aria-label="Secciones de finanzas">
        <button id="tab-cargos" role="tab" aria-selected={tab === 'cargos'} aria-controls="panel-cargos" tabIndex={tab === 'cargos' ? 0 : -1} className={tab === 'cargos' ? 'activa' : ''} onKeyDown={navegarTabs} onClick={() => setTab('cargos')}>Cargos</button>
        <button id="tab-pagos" role="tab" aria-selected={tab === 'pagos'} aria-controls="panel-pagos" tabIndex={tab === 'pagos' ? 0 : -1} className={tab === 'pagos' ? 'activa' : ''} onKeyDown={navegarTabs} onClick={() => setTab('pagos')}>Pagos</button>
        <button id="tab-adeudos" role="tab" aria-selected={tab === 'adeudos'} aria-controls="panel-adeudos" tabIndex={tab === 'adeudos' ? 0 : -1} className={tab === 'adeudos' ? 'activa' : ''} onKeyDown={navegarTabs} onClick={() => setTab('adeudos')}>Adeudos y cobranza</button>
      </div>}

      {error && <p className="mensaje-error" role="alert">{error}</p>}
      {mensaje && <p className="mensaje-ok" role="status">{mensaje}</p>}
      {cargando && <p role="status">Cargando {tab}…</p>}

      {(legado || modo === 'conciliacion') && <Conciliacion />}
      {(legado || ['colegiaturas', 'adeudos'].includes(modo)) && <section className="panel"><label htmlFor="plantel-operacion">Plantel para operaciones masivas</label>
        <select id="plantel-operacion" value={plantelOperacion} onChange={(e) => setPlantelOperacion(e.target.value)}><option value="">Selecciona un plantel…</option>{planteles.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}</select>
        <p>Las colegiaturas, recargos y avisos requieren previsualización y confirmación para este plantel.</p>
      </section>}
      <div aria-busy={cargando}>
      {tab === 'cargos' && (
        <PanelCargos vista={legado ? 'legado' : modo === 'cargo-nuevo' ? 'nuevo' : modo === 'colegiaturas' ? 'colegiaturas' : 'consulta'} crearCargo={crearCargo} formCargo={formCargo} setFormCargo={setFormCargo} conceptos={conceptos} enviando={enviando} generarColegiaturas={generarColegiaturas} formColegiaturas={formColegiaturas} setFormColegiaturas={setFormColegiaturas} ciclos={ciclos} aplicarRecargos={aplicarRecargos} resultadoCargos={resultadoCargos} corregir={corregir} cargarCargos={legado ? cargarCargos : async p => trabajo.actualizar({ pagina: String(p || 1) })} />
      )}

      {tab === 'pagos' && (
        <PanelPagos vista={legado ? 'legado' : modo === 'pago-nuevo' ? 'nuevo' : 'consulta'} registrarPago={registrarPago} formPago={formPago} setFormPago={setFormPago} enviando={enviando} resultadoPagos={resultadoPagos} corregir={corregir} cargarPagos={legado ? cargarPagos : async p => trabajo.actualizar({ pagina: String(p || 1) })} />
      )}

      {tab === 'adeudos' && (
        <PanelAdeudos enviando={enviando} enviarAvisos={enviarAvisos} descargarExcel={descargarExcel} adeudos={adeudos} corregir={corregir} totalAdeudos={totalAdeudos} paginaAdeudos={paginaAdeudos} cargarAdeudos={legado ? cargarAdeudos : async p => trabajo.actualizar({ pagina: String(p || 1) })} />
      )}
      </div>
    </>
  );
}
