import { EliminarRegistro } from '../components/EliminarRegistro';
import { useConfirmacion } from '../components/useConfirmacion';
import { useDialogoMotivo } from '../components/useDialogoMotivo';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { api, mensajeDeError } from '../api/client';
import { Encabezado } from '../components/Encabezado';
import { PanelAccionesModulo } from '../components/PanelAccionesModulo';
import { Paginador } from '../components/Paginador';
import '../components/tabla-adaptable.css';

interface Docente {
  id: number;
  numEmpleado: string;
  especialidad?: string; cedulaProfesional?: string;
  estatus: string;
  usuario: { nombre: string; apellidoPaterno: string; apellidoMaterno?: string; telefono?: string; email: string };
  planteles: string[];
}
interface Plantel { id: number; nombre: string }
interface Resultado { datos: Docente[]; total: number; pagina: number; porPagina: number }

export default function DocentesPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const vista = params.get('vista') === 'consulta' ? 'consulta' : 'panel';
  const filtroPlantel = params.get('plantel') || '';
  const buscar = params.get('buscar') || '';
  const paginaActual = Math.max(1, Number.parseInt(params.get('pagina') || '1', 10) || 1);
  const [termino, setTermino] = useState(buscar);
  const tituloListado = useRef<HTMLHeadingElement>(null);
  const confirmacion = useConfirmacion();
  const dialogoMotivo = useDialogoMotivo();
  const [resultado, setResultado] = useState<Resultado>({ datos: [], total: 0, pagina: 1, porPagina: 10 });
  const [planteles, setPlanteles] = useState<Plantel[]>([]);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState(location.state?.mensaje || '');
  const [enviando, setEnviando] = useState(false);
  const [cargando, setCargando] = useState(false); const consulta = useRef(0);
  const consultaDetalle = useRef(0);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);
  const [detalle, setDetalle] = useState<{ id: number; estatus: string; plantelIds: number[]; clases: { id: number; grupo: string; materia: string; ciclo: string; plantel: string; nivel?: string | null; carrera?: string | null; versionPlan?: string | null; periodo?: string | null; turno?: string | null; vigente: boolean }[] } | null>(null);
  const verClases = async (d: Docente) => {
    const actual = ++consultaDetalle.current;
    setDetalle(null);
    setError('');
    setCargandoDetalle(true);
    try {
      const { data } = await api.get<NonNullable<typeof detalle>>(`/docentes/${d.id}`);
      if (actual === consultaDetalle.current) setDetalle(data);
    } catch (err) {
      if (actual === consultaDetalle.current) setError(mensajeDeError(err));
    } finally {
      if (actual === consultaDetalle.current) setCargandoDetalle(false);
    }
  };
  const guardarPlanteles = async () => {
    if (!detalle || enviando || !await confirmacion.solicitar('¿Confirmar los planteles del docente? Las clases deben reasignarse antes de retirar un plantel.')) return;
    const guardar = async (motivo?: string) => {
      await api.post(`/docentes/${detalle.id}/${detalle.estatus === 'BAJA' ? 'reactivacion' : 'planteles'}`, { plantelIds: detalle.plantelIds, ...(motivo ? { motivo } : {}) }); setMensaje('Planteles actualizados'); setDetalle(null); cargar(1, filtroPlantel);
    };
    if (detalle.estatus === 'BAJA') { dialogoMotivo.abrir({ titulo: 'Reactivar docente', advertencia: 'Las clases no se restauran automáticamente.', ejecutar: guardar }); return; }
    setEnviando(true); setError('');
    try { await guardar(); } catch (err) { setError(mensajeDeError(err)); } finally { setEnviando(false); }
  };

  const editar = (d: Docente) => navigate(`/docentes/${d.id}/editar${location.search}`);
  const cambiarConsulta = (cambios: Record<string, string>) => setParams((previos) => {
    const nuevos = new URLSearchParams(previos);
    for (const [clave, valor] of Object.entries(cambios)) {
      if (valor) nuevos.set(clave, valor); else nuevos.delete(clave);
    }
    return nuevos;
  });

  const cargar = useCallback((pagina = 1, plantelId = '') => {
    const actual = ++consulta.current; setCargando(true); setError('');
    api.get<Resultado>('/docentes', { params: { pagina, porPagina: 10, ...(buscar ? { buscar } : {}), ...(plantelId ? { plantelId } : {}) } })
      .then((r) => { if (actual === consulta.current) setResultado(r.data); })
      .catch((err) => { if (actual === consulta.current) setError(mensajeDeError(err)); })
      .finally(() => { if (actual === consulta.current) setCargando(false); });
  }, [buscar]);
  useEffect(() => {
    let activo = true;
    api.get<Plantel[]>('/planteles/mios')
      .then((r) => { if (activo) setPlanteles(r.data); })
      .catch((err) => { if (activo) setError(mensajeDeError(err)); });
    return () => {
      activo = false;
      consulta.current += 1;
      consultaDetalle.current += 1;
    };
  }, []);

  useEffect(() => {
    if (vista === 'consulta') cargar(paginaActual, filtroPlantel);
    return () => { consulta.current++; };
  }, [vista, paginaActual, filtroPlantel, cargar]);
  useEffect(() => { setTermino(buscar); }, [buscar]);
  useEffect(() => {
    if (termino === buscar) return;
    const timer = setTimeout(() => setParams((previos) => {
      const nuevos = new URLSearchParams(previos);
      if (termino.trim()) nuevos.set('buscar', termino.trim()); else nuevos.delete('buscar');
      nuevos.delete('pagina');
      return nuevos;
    }, { replace: true }), 300);
    return () => clearTimeout(timer);
  }, [termino, buscar, setParams]);
  useEffect(() => { if (vista === 'consulta') tituloListado.current?.focus(); }, [vista]);

  const baja = async (docente: Docente) => {
    if (!await confirmacion.solicitar(`¿Dar de baja al docente ${docente.numEmpleado}?`)) return;
    setEnviando(true); setError('');
    try { await api.post(`/docentes/${docente.id}/baja`); setMensaje('Docente dado de baja. Reasigna sus clases desde Grupos.'); cargar(1, filtroPlantel); }
    catch (err) { setError(mensajeDeError(err)); } finally { setEnviando(false); }
  };

  return (
    <>{confirmacion.elemento}{dialogoMotivo.elemento}
      <Encabezado titulo="Docentes" detalle="Plantilla docente y cuentas de acceso" />
      {vista === 'panel' && <PanelAccionesModulo titulo="Gestión de docentes" acciones={[
        { titulo: 'Registrar docente', detalle: 'Crear expediente e invitar por correo', ejecutar: () => navigate('/docentes/nuevo') },
        { titulo: 'Consultar docentes', detalle: 'Buscar por plantel y revisar clases', ejecutar: () => cambiarConsulta({ vista: 'consulta' }) },
        { titulo: 'Editar o dar de baja', detalle: 'Buscar primero el expediente que deseas gestionar', ejecutar: () => cambiarConsulta({ vista: 'consulta' }) },
      ]} />}
      {vista !== 'panel' && <button type="button" className="boton secundario" onClick={() => { consultaDetalle.current++; setDetalle(null); setCargandoDetalle(false); cambiarConsulta({ vista: '' }); }}>Volver a opciones</button>}
      {error && <p role="alert" className="mensaje-error">{error}</p>}
      {vista === 'consulta' && mensaje && <p role="status" className="mensaje-ok">{mensaje}</p>}

      {vista === 'consulta' && <><div className="fila" style={{ marginBottom: 12 }}><div className="campo"><label htmlFor="buscar-docente">Buscar docentes</label><input id="buscar-docente" value={termino} onChange={(e) => setTermino(e.target.value)} placeholder="Nombre, apellido o número de empleado" /></div><div className="campo"><label htmlFor="docentes-campo-7">Filtrar por plantel</label><select id="docentes-campo-7" value={filtroPlantel} onChange={(e) => cambiarConsulta({ plantel: e.target.value, pagina: '' })}><option value="">Todos</option>{planteles.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}</select></div><button className="boton secundario" disabled={cargando} onClick={() => cargar(paginaActual, filtroPlantel)}>Actualizar</button></div>

      {cargandoDetalle && <p role="status">Cargando planteles y clases del docente…</p>}
      {detalle && <section className="panel"><h2>Planteles y clases</h2><fieldset><legend>Planteles del docente</legend>
        {planteles.map((p) => <label key={p.id} className="casilla"><input type="checkbox" checked={detalle.plantelIds.includes(p.id)} onChange={() => setDetalle({ ...detalle,
          plantelIds: detalle.plantelIds.includes(p.id) ? detalle.plantelIds.filter((id) => id !== p.id) : [...detalle.plantelIds, p.id] })} />{p.nombre}</label>)}
      </fieldset><button disabled={enviando} onClick={guardarPlanteles}>{detalle.estatus === 'BAJA' ? 'Reactivar con estos planteles' : 'Guardar planteles'}</button><button type="button" onClick={() => { consultaDetalle.current += 1; setDetalle(null); setCargandoDetalle(false); }}>Cerrar</button>
        {detalle.clases.map((c) => <p key={c.id}>{c.ciclo} · {c.plantel} · {c.grupo} · {c.nivel ?? 'Sin nivel registrado'} · {c.carrera ?? 'Sin carrera registrada'} {c.versionPlan ? `· Plan ${c.versionPlan}` : ''} · {c.periodo ?? 'Sin periodo registrado'} · {c.turno ?? 'Sin turno registrado'} · {c.materia} · {c.vigente ? 'Vigente' : 'Histórico'}</p>)}
        <a href="/grupos">Reasignar clases desde Grupos</a>
      </section>}
      <div className="cabecera-listado"><h2 ref={tituloListado} tabIndex={-1}>Directorio de docentes</h2><p>{resultado.total} registros</p></div>
      {cargando && <p role="status">Cargando docentes…</p>}
      <div className="tabla-contenedor" role="region" aria-label="Listado de docentes" tabIndex={0}>
      <table className="tabla tabla-adaptable" aria-busy={cargando}>
        <caption className="solo-lector">Número de empleado, docente, planteles, especialidad, correo, estatus y acciones</caption>
        <thead>
          <tr><th scope="col">Empleado</th><th scope="col">Nombre</th><th scope="col">Planteles</th><th scope="col">Especialidad</th><th scope="col">Correo</th><th scope="col">Estatus</th><th scope="col">Acciones</th></tr>
        </thead>
        <tbody>
          {resultado.datos.map((d) => (
            <tr key={d.id}>
              <td data-etiqueta="Empleado">{d.numEmpleado}</td>
              <td data-etiqueta="Nombre">{d.usuario.nombre} {d.usuario.apellidoPaterno}</td>
              <td data-etiqueta="Planteles">{d.planteles.join(', ') || '—'}</td>
              <td data-etiqueta="Especialidad">{d.especialidad ?? '—'}</td>
              <td data-etiqueta="Correo">{d.usuario.email}</td>
              <td data-etiqueta="Estatus"><span className={`sello ${d.estatus === 'ACTIVO' ? 'ok' : 'neutro'}`}>{d.estatus}</span></td>
              <td data-etiqueta="Acciones" className="derecha"><span className="acciones-fila"><EliminarRegistro ruta={`/docentes/${d.id}`} nombre={`docente ${d.numEmpleado}`} deshabilitado={enviando} alEliminar={() => { consultaDetalle.current++; setDetalle(null); setMensaje('Docente y cuenta eliminados definitivamente'); cargar(1, filtroPlantel); }} /><button disabled={enviando} className="boton secundario chico" onClick={() => editar(d)}>Editar</button> <button disabled={enviando} className="boton secundario chico" onClick={() => verClases(d)}>Planteles y clases</button> {d.estatus === 'ACTIVO' && <button disabled={enviando} className="boton peligro chico" onClick={() => baja(d)}>Dar de baja</button>}</span></td>
            </tr>
          ))}
          {!cargando && resultado.datos.length === 0 && <tr><td className="vacio" colSpan={7}>Sin docentes registrados.</td></tr>}
        </tbody>
      </table></div>
      <Paginador total={resultado.total} pagina={resultado.pagina} porPagina={resultado.porPagina} deshabilitado={cargando} onCambio={(pagina) => cambiarConsulta({ pagina: String(pagina) })} />
      </>}
    </>
  );
}
