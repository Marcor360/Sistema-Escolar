import { FormEvent, KeyboardEvent, useCallback, useEffect, useState } from 'react';
import { api, mensajeDeError } from '../api/client';
import { pesos, selloDeCargo } from '../utils/formato';
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
  const [tab, setTab] = useState<'cargos' | 'pagos' | 'adeudos'>('cargos');
  const [alumnos, setAlumnos] = useState<Alumno[]>([]);
  const [conceptos, setConceptos] = useState<Concepto[]>([]);
  const [ciclos, setCiclos] = useState<Ciclo[]>([]);
  const [resultadoCargos, setResultadoCargos] = useState<ResultadoCargos>({ datos: [], total: 0, pagina: 1, porPagina: 20 });
  const [resultadoPagos, setResultadoPagos] = useState<ResultadoPagos>({ datos: [], total: 0, pagina: 1, porPagina: 20 });
  const [adeudos, setAdeudos] = useState<Adeudo[]>([]);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');

  const [formCargo, setFormCargo] = useState({ alumnoId: '', conceptoId: '', descripcion: '', monto: '', fechaVencimiento: '' });
  const [formColegiaturas, setFormColegiaturas] = useState({ cicloId: '', periodo: '' });
  const [formPago, setFormPago] = useState({ alumnoId: '', cargoId: '', monto: '', metodo: 'EFECTIVO', referencia: '' });
  const [cargosAlumno, setCargosAlumno] = useState<Cargo[]>([]);
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
      const [alumnosR, conceptosR, ciclosR] = await Promise.all([
        api.get<{ datos: Alumno[] }>('/alumnos', { params: { porPagina: 100 } }),
        api.get<Concepto[]>('/finanzas/conceptos'),
        api.get<Ciclo[]>('/academico/ciclos'),
      ]);
      setAlumnos(alumnosR.data.datos);
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
    try { const { data } = await api.get<Adeudo[]>('/finanzas/adeudos'); setAdeudos(data); }
    catch (err) { setError(mensajeDeError(err)); }
  }, [cargarCargos, cargarPagos]);
  useEffect(() => { cargarCatalogos(); cargarDatos(); }, [cargarCatalogos, cargarDatos]);

  /** Cargos con saldo del alumno elegido, para el selector de "pago a cargo" (independiente de la página visible). */
  useEffect(() => {
    if (!formPago.alumnoId) { setCargosAlumno([]); return; }
    api.get<ResultadoCargos>('/finanzas/cargos', { params: { alumnoId: formPago.alumnoId, porPagina: 100 } })
      .then((r) => setCargosAlumno(r.data.datos))
      .catch((err) => setError(mensajeDeError(err)));
  }, [formPago.alumnoId]);

  const limpiarAvisos = () => { setError(''); setMensaje(''); };

  const crearCargo = async (e: FormEvent) => {
    e.preventDefault();
    limpiarAvisos();
    try {
      await api.post('/finanzas/cargos', {
        alumnoId: Number(formCargo.alumnoId),
        conceptoId: Number(formCargo.conceptoId),
        descripcion: formCargo.descripcion,
        monto: Number(formCargo.monto),
        fechaVencimiento: formCargo.fechaVencimiento || undefined,
      });
      setFormCargo({ alumnoId: '', conceptoId: '', descripcion: '', monto: '', fechaVencimiento: '' });
      setMensaje('Cargo registrado');
      cargarDatos();
    } catch (err) { setError(mensajeDeError(err)); }
  };

  const generarColegiaturas = async (e: FormEvent) => {
    e.preventDefault();
    limpiarAvisos();
    try {
      const { data } = await api.post('/finanzas/cargos/generar-colegiaturas', {
        cicloId: Number(formColegiaturas.cicloId),
        periodo: formColegiaturas.periodo,
      });
      setMensaje(`Colegiaturas: ${data.generados} generadas, ${data.omitidos} ya existían (vencen ${data.vencimiento})`);
      cargarDatos();
    } catch (err) { setError(mensajeDeError(err)); }
  };

  const aplicarRecargos = async () => {
    limpiarAvisos();
    try {
      const { data } = await api.post('/finanzas/cargos/aplicar-recargos', {});
      setMensaje(`Recargos del ${data.porcentaje}% aplicados a ${data.aplicados} cargos vencidos`);
      cargarDatos();
    } catch (err) { setError(mensajeDeError(err)); }
  };

  const registrarPago = async (e: FormEvent) => {
    e.preventDefault();
    limpiarAvisos();
    try {
      await api.post('/finanzas/pagos', {
        alumnoId: Number(formPago.alumnoId),
        cargoId: formPago.cargoId ? Number(formPago.cargoId) : undefined,
        monto: Number(formPago.monto),
        metodo: formPago.metodo,
        referencia: formPago.referencia || undefined,
      });
      setFormPago({ alumnoId: '', cargoId: '', monto: '', metodo: 'EFECTIVO', referencia: '' });
      setMensaje('Pago registrado y estado de cuenta actualizado');
      cargarDatos();
    } catch (err) { setError(mensajeDeError(err)); }
  };

  const enviarAvisos = async () => {
    limpiarAvisos();
    try {
      const { data } = await api.post('/finanzas/avisos-cobranza');
      setMensaje(`Avisos de cobranza enviados: ${data.enviados}`);
    } catch (err) { setError(mensajeDeError(err)); }
  };

  const descargarExcel = async () => {
    limpiarAvisos();
    try {
      const { data } = await api.get('/reportes/adeudos.xlsx', { responseType: 'blob' });
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'adeudos.xlsx';
      a.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) { setError(mensajeDeError(err)); }
  };

  return (
    <>
      <Encabezado titulo="Finanzas" detalle="Cargos, pagos, adeudos y cobranza" />

      <div className="tabs" role="tablist" aria-label="Secciones de finanzas">
        <button id="tab-cargos" role="tab" aria-selected={tab === 'cargos'} aria-controls="panel-cargos" tabIndex={tab === 'cargos' ? 0 : -1} className={tab === 'cargos' ? 'activa' : ''} onKeyDown={navegarTabs} onClick={() => setTab('cargos')}>Cargos</button>
        <button id="tab-pagos" role="tab" aria-selected={tab === 'pagos'} aria-controls="panel-pagos" tabIndex={tab === 'pagos' ? 0 : -1} className={tab === 'pagos' ? 'activa' : ''} onKeyDown={navegarTabs} onClick={() => setTab('pagos')}>Pagos</button>
        <button id="tab-adeudos" role="tab" aria-selected={tab === 'adeudos'} aria-controls="panel-adeudos" tabIndex={tab === 'adeudos' ? 0 : -1} className={tab === 'adeudos' ? 'activa' : ''} onKeyDown={navegarTabs} onClick={() => setTab('adeudos')}>Adeudos y cobranza</button>
      </div>

      {error && <p className="mensaje-error" role="alert">{error}</p>}
      {mensaje && <p className="mensaje-ok" role="status">{mensaje}</p>}

      {tab === 'cargos' && (
        <div id="panel-cargos" role="tabpanel" aria-labelledby="tab-cargos" tabIndex={0}>
          <section className="panel">
            <h2>Nuevo cargo individual</h2>
            <form onSubmit={crearCargo} className="fila">
              <div className="campo"><label>Alumno</label>
                <select required value={formCargo.alumnoId} onChange={(e) => setFormCargo({ ...formCargo, alumnoId: e.target.value })}>
                  <option value="">Selecciona…</option>
                  {alumnos.map((a) => <option key={a.id} value={a.id}>{a.matricula} — {a.usuario.nombre} {a.usuario.apellidoPaterno}</option>)}
                </select>
              </div>
              <div className="campo"><label>Concepto</label>
                <select
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
                  {conceptos.map((c) => <option key={c.id} value={c.id}>{c.clave} — {c.nombre}</option>)}
                </select>
              </div>
              <div className="campo"><label>Descripción</label>
                <input required value={formCargo.descripcion} onChange={(e) => setFormCargo({ ...formCargo, descripcion: e.target.value })} />
              </div>
              <div className="campo"><label>Monto</label>
                <input type="number" min={0} step={0.01} required value={formCargo.monto} onChange={(e) => setFormCargo({ ...formCargo, monto: e.target.value })} />
              </div>
              <div className="campo"><label>Vence</label>
                <input type="date" value={formCargo.fechaVencimiento} onChange={(e) => setFormCargo({ ...formCargo, fechaVencimiento: e.target.value })} />
              </div>
              <button className="boton">Registrar cargo</button>
            </form>
          </section>

          <section className="panel">
            <h2>Generar colegiaturas del periodo</h2>
            <form onSubmit={generarColegiaturas} className="fila">
              <div className="campo"><label>Ciclo</label>
                <select required value={formColegiaturas.cicloId} onChange={(e) => setFormColegiaturas({ ...formColegiaturas, cicloId: e.target.value })}>
                  <option value="">Selecciona…</option>
                  {ciclos.map((c) => <option key={c.id} value={c.id}>{c.clave}</option>)}
                </select>
              </div>
              <div className="campo"><label>Periodo (AAAA-MM)</label>
                <input required pattern="\d{4}-\d{2}" placeholder="2026-09" value={formColegiaturas.periodo}
                  onChange={(e) => setFormColegiaturas({ ...formColegiaturas, periodo: e.target.value })} />
              </div>
              <button className="boton">Generar para inscritos</button>
              <button type="button" className="boton secundario" onClick={aplicarRecargos}>Aplicar recargos a vencidos</button>
            </form>
          </section>

          <table className="tabla">
            <thead><tr><th>Alumno</th><th>Descripción</th><th>Periodo</th><th>Vence</th><th className="derecha">Monto</th><th className="derecha">Recargo</th><th>Estatus</th></tr></thead>
            <tbody>
              {resultadoCargos.datos.map((c) => (
                <tr key={c.id}>
                  <td>{c.alumno.matricula}</td>
                  <td>{c.descripcion}</td>
                  <td>{c.periodo ?? '—'}</td>
                  <td>{c.fechaVencimiento ?? '—'}</td>
                  <td className="derecha monto">{pesos(c.monto - c.descuento)}</td>
                  <td className="derecha monto">{c.recargo > 0 ? pesos(c.recargo) : '—'}</td>
                  <td><span className={`sello ${selloDeCargo(c.estatus)}`}>{c.estatus}</span></td>
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
              <div className="campo"><label>Alumno</label>
                <select required value={formPago.alumnoId} onChange={(e) => setFormPago({ ...formPago, alumnoId: e.target.value, cargoId: '' })}>
                  <option value="">Selecciona…</option>
                  {alumnos.map((a) => <option key={a.id} value={a.id}>{a.matricula} — {a.usuario.nombre} {a.usuario.apellidoPaterno}</option>)}
                </select>
              </div>
              <div className="campo"><label>Cargo (opcional)</label>
                <select value={formPago.cargoId} onChange={(e) => setFormPago({ ...formPago, cargoId: e.target.value })}>
                  <option value="">Pago a cuenta</option>
                  {cargosAlumno
                    .filter((c) => c.estatus !== 'PAGADO' && c.estatus !== 'CANCELADO')
                    .map((c) => <option key={c.id} value={c.id}>{c.descripcion} ({c.estatus})</option>)}
                </select>
              </div>
              <div className="campo"><label>Monto</label>
                <input type="number" min={0.01} step={0.01} required value={formPago.monto} onChange={(e) => setFormPago({ ...formPago, monto: e.target.value })} />
              </div>
              <div className="campo"><label>Método</label>
                <select value={formPago.metodo} onChange={(e) => setFormPago({ ...formPago, metodo: e.target.value })}>
                  <option>EFECTIVO</option><option>TRANSFERENCIA</option><option>TARJETA</option>
                </select>
              </div>
              <div className="campo"><label>Referencia</label>
                <input value={formPago.referencia} onChange={(e) => setFormPago({ ...formPago, referencia: e.target.value })} />
              </div>
              <button className="boton">Registrar pago</button>
            </form>
          </section>

          <table className="tabla">
            <thead><tr><th>Fecha</th><th>Alumno</th><th className="derecha">Monto</th><th>Método</th><th>Referencia</th><th>Estatus</th></tr></thead>
            <tbody>
              {resultadoPagos.datos.map((p) => (
                <tr key={p.id}>
                  <td>{new Date(p.fechaPago).toLocaleString('es-MX')}</td>
                  <td>{p.alumno.matricula} — {p.alumno.usuario.nombre} {p.alumno.usuario.apellidoPaterno}</td>
                  <td className="derecha monto">{pesos(p.monto)}</td>
                  <td>{p.metodo}</td>
                  <td>{p.referencia ?? '—'}</td>
                  <td><span className={`sello ${p.estatus === 'CONFIRMADO' ? 'ok' : 'aviso'}`}>{p.estatus}</span></td>
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
            <button className="boton" onClick={enviarAvisos}>Enviar avisos de cobranza</button>
            <button className="boton secundario" onClick={descargarExcel}>Descargar Excel de adeudos</button>
          </div>
          <table className="tabla">
            <thead><tr><th>Alumno</th><th>Concepto</th><th>Vence</th><th className="derecha">Total</th><th className="derecha">Pagado</th><th className="derecha">Saldo</th><th>Estatus</th></tr></thead>
            <tbody>
              {adeudos.map((c) => (
                <tr key={c.id}>
                  <td>{c.alumno.matricula} — {c.alumno.usuario.nombre} {c.alumno.usuario.apellidoPaterno}</td>
                  <td>{c.descripcion}</td>
                  <td>{c.fechaVencimiento ?? '—'}</td>
                  <td className="derecha monto">{pesos(c.total)}</td>
                  <td className="derecha monto">{pesos(c.pagado)}</td>
                  <td className="derecha monto"><b>{pesos(c.saldo)}</b></td>
                  <td><span className={`sello ${selloDeCargo(c.estatus)}`}>{c.estatus}</span></td>
                </tr>
              ))}
              {adeudos.length === 0 && <tr><td className="vacio" colSpan={7}>Sin adeudos: todos los cargos están cubiertos.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
