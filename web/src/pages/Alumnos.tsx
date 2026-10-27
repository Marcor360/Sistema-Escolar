import { useModuloTrabajo } from '../components/ModuloTrabajo';
import { Link } from 'react-router-dom';
import { EliminarRegistro } from '../components/EliminarRegistro';
import { FORM_INICIAL } from '../features/alumnos/tipos';
import { FormularioAlumno } from '../features/alumnos/FormularioAlumno';
import { HistorialAlumno, type HistorialConsulta } from '../features/alumnos/HistorialAlumno';
import { TransferirAlumno } from '../features/alumnos/TransferirAlumno';
import type { Alumno, Historial, Nota, Plantel, Resultado } from '../features/alumnos/tipos';
import { useConfirmacion } from '../components/useConfirmacion';
import { useDialogoMotivo } from '../components/useDialogoMotivo';
import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { api, mensajeDeError } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { Encabezado } from '../components/Encabezado';
import { Paginador } from '../components/Paginador';
import '../components/tabla-adaptable.css';









export default function AlumnosPage() {
  const [enviando, setEnviando] = useState(false);
  const trabajo = useModuloTrabajo(enviando), { modo } = trabajo;
  const consultaVisible = modo === 'legado' || modo === 'consulta';

  const confirmacion = useConfirmacion();
  const dialogoMotivo = useDialogoMotivo();
  const [resultado, setResultado] = useState<Resultado>({ datos: [], total: 0, pagina: 1, porPagina: 10 });
  const [planteles, setPlanteles] = useState<Plantel[]>([]);
  const [plantelId, setPlantelId] = useState('');
  const [cargando, setCargando] = useState(true);
  const consulta = useRef(0);
  const [buscar, setBuscar] = useState('');
  const [busquedaAplicada, setBusquedaAplicada] = useState('');
  const [plantelAplicado, setPlantelAplicado] = useState('');
  const filtrosAplicados = useRef({ buscar: '', plantelId: '' });
  const [form, setForm] = useState(FORM_INICIAL);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const { tieneRol } = useAuth();
  const puedeGestionar = tieneRol('ADMINISTRATIVO');
  const puedeCrear = tieneRol('FINANZAS', 'SUPERADMIN');
  const puedeAbrirCartera = tieneRol('ADMINISTRATIVO', 'SUPERADMIN');
  const [editando, setEditando] = useState<number | null>(null);
  const mostrarFormulario = modo === 'legado' ? puedeCrear || (puedeGestionar && editando !== null) : (modo === 'nuevo' && puedeCrear) || (modo === 'editar' && puedeGestionar && editando !== null);
  const [transferencia, setTransferencia] = useState<Alumno | null>(null);
  const [destino, setDestino] = useState('');
  const [historial, setHistorial] = useState<HistorialConsulta | null>(null);
  const [vistaEgresados, setVistaEgresados] = useState(false);
  const filtroEgresados = useRef(false);
  const [historialCargando, setHistorialCargando] = useState(false);
  const [notas, setNotas] = useState<Nota[] | null>(null);
  const [cargandoNotas, setCargandoNotas] = useState(false);
  const notasSolicitud = useRef(0);
  const historialSolicitud = useRef(0);
  const invalidarNotas = () => { notasSolicitud.current++; setNotas(null); setCargandoNotas(false); };
  useEffect(() => () => { notasSolicitud.current++; historialSolicitud.current++; }, []);
  const verNotas = async (alumno: Alumno, inscripcion: Historial) => {
    const solicitud = ++notasSolicitud.current;
    setCargandoNotas(true); setNotas(null); setError('');
    try {
      const { data } = await api.get<Nota[]>(`/calificaciones/alumno/${alumno.id}`, { params: { cicloId: inscripcion.grupo.ciclo.id } });
      if (solicitud !== notasSolicitud.current) return;
      setNotas(data.filter((n) => n.grupoMateria.grupo.id === inscripcion.grupo.id));
    } catch (err) { if (solicitud === notasSolicitud.current) setError(mensajeDeError(err)); } finally { if (solicitud === notasSolicitud.current) setCargandoNotas(false); }
  };
  const verHistorial = async (alumno: Alumno, pagina = 1) => {
    invalidarNotas();
    const solicitud = ++historialSolicitud.current;
    setHistorialCargando(true);
    try {
      const { data } = await api.get<{ datos: Historial[]; total: number; pagina: number; porPagina: number; egreso: HistorialConsulta['egreso'] }>(
        `/alumnos/${alumno.id}/historial/listado`, { params: { pagina, porPagina: 10 } },
      );
      if (solicitud !== historialSolicitud.current) return;
      invalidarNotas();
      setHistorial({ alumno, registros: data.datos, total: data.total, pagina: data.pagina, porPagina: data.porPagina, egreso: data.egreso });
      setNotas(null);
    } catch (err) { if (solicitud === historialSolicitud.current) setError(mensajeDeError(err)); }
    finally { if (solicitud === historialSolicitud.current) setHistorialCargando(false); }
  };
  const editar = async (alumno: Pick<Alumno, 'id'>) => {
    if (enviando) return;
    setEnviando(true); setError('');
    try {
      const { data } = await api.get(`/alumnos/${alumno.id}`);
      setForm({ ...FORM_INICIAL, matricula: data.matricula, plantelId: String(data.plantelId),
        nombre: data.usuario.nombre, apellidoPaterno: data.usuario.apellidoPaterno, apellidoMaterno: data.usuario.apellidoMaterno ?? '', telefono: data.usuario.telefono ?? '', email: data.usuario.email, correoPersonal: data.usuario.correoPersonal ?? '', correoProveedor: data.usuario.correoProveedor ?? 'MICROSOFT365', curp: data.curp ?? '', fechaNacimiento: data.fechaNacimiento ?? '', direccion: data.direccion ?? '',
        tutorNombre: data.tutorNombre ?? '', tutorTelefono: data.tutorTelefono ?? '' });
      setEditando(alumno.id);
      if (modo !== 'legado') trabajo.ir('editar', alumno.id);
      document.getElementById('form-alumno')?.scrollIntoView();
    } catch (err) { setError(mensajeDeError(err)); } finally { setEnviando(false); }
  };
  const egresar = async (alumno: Alumno) => {
    if (!await confirmacion.solicitar('¿Egresar al alumno? Se terminarán sus inscripciones y su acceso; conservará el expediente.')) return;
    setEnviando(true); setError('');
    try { await api.post(`/alumnos/${alumno.id}/egreso`); setMensaje('Alumno egresado'); recargarListado(); }
    catch (err) { setError(mensajeDeError(err)); } finally { setEnviando(false); }
  };
  const transferir = async (e: FormEvent) => {
    e.preventDefault();
    if (!transferencia || !await confirmacion.solicitar('¿Transferir? Se darán de baja las inscripciones anteriores. Deberás inscribirlo en el grupo del nuevo plantel.')) return;
    setEnviando(true); setError('');
    try {
      await api.post(`/alumnos/${transferencia.id}/transferencia`, { plantelId: Number(destino) });
      setTransferencia(null); setMensaje('Transferencia completada. Inscribe al alumno en el grupo de destino.'); recargarListado();
    } catch (err) { setError(mensajeDeError(err)); } finally { setEnviando(false); }
  };

  const consultar = useCallback((pagina = 1, termino = '', filtroPlantel = '') => {
    const actual = ++consulta.current;
    setCargando(true);
    setError('');
    setBusquedaAplicada(termino);
    setPlantelAplicado(filtroPlantel);
    filtrosAplicados.current = { buscar: termino, plantelId: filtroPlantel };
    api.get<Resultado>('/alumnos', {
      params: { pagina, ...(termino ? { buscar: termino } : {}), ...(filtroPlantel ? { plantelId: filtroPlantel } : {}), { vista: filtroEgresados.current ? 'EGRESADOS' : 'REGULARES' } },
    })
      .then((r) => { if (actual === consulta.current) setResultado(r.data); })
      .catch((err) => { if (actual === consulta.current) setError(mensajeDeError(err)); })
      .finally(() => { if (actual === consulta.current) setCargando(false); });
  }, []);
  const paginaConsulta = Math.max(1, Number.parseInt(trabajo.query.get('pagina') || '1', 10) || 1);
  const busquedaConsulta = trabajo.query.get('buscar') || '', plantelConsulta = trabajo.query.get('plantel') || '';
  const cargar = (pagina = 1, termino = '', plantel = '') => {
    if (modo === 'legado') consultar(pagina, termino, plantel);
    else trabajo.actualizar({ pagina: String(pagina), buscar: termino, plantel });
  };
  const recargarListado = () => consultar(modo === 'legado' ? 1 : paginaConsulta, filtrosAplicados.current.buscar, filtrosAplicados.current.plantelId);
  useEffect(() => {
    api.get<Plantel[]>('/planteles/mios').then(r => setPlanteles(r.data)).catch(err => setError(mensajeDeError(err)));
    return () => { consulta.current++; };
  }, []);
  useEffect(() => {
    if (!consultaVisible) return;
    setBuscar(busquedaConsulta); setPlantelId(plantelConsulta);
    consultar(paginaConsulta, busquedaConsulta, plantelConsulta);
  }, [consultaVisible, paginaConsulta, busquedaConsulta, plantelConsulta, consultar]);
  useEffect(() => {
    if (modo === 'nuevo' || modo === 'consulta') { setEditando(null); setForm(FORM_INICIAL); }
    if (modo === 'editar' && trabajo.id && puedeGestionar && editando !== trabajo.id) void editar({ id: trabajo.id });
  // Los datos iniciales solo se recargan al cambiar de pantalla o expediente.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modo, trabajo.id]);

  const crear = async (e: FormEvent) => {
    e.preventDefault();
    if (enviando) return;
    setEnviando(true); setError(''); setMensaje('');
    try {
      if (editando) {
        await api.patch(`/alumnos/${editando}`, {
          nombre: form.nombre, apellidoPaterno: form.apellidoPaterno, apellidoMaterno: form.apellidoMaterno,
          telefono: form.telefono, correoPersonal: form.correoPersonal || null, correoProveedor: form.correoProveedor, fechaNacimiento: form.fechaNacimiento || null, direccion: form.direccion, curp: form.curp, tutorNombre: form.tutorNombre, tutorTelefono: form.tutorTelefono,
        });
      } else await api.post('/alumnos', {
        ...form,
        correoPersonal: form.correoPersonal || undefined,
        plantelId: Number(form.plantelId),
        apellidoMaterno: form.apellidoMaterno || undefined,
        curp: form.curp, telefono: form.telefono || undefined, fechaNacimiento: form.fechaNacimiento || undefined, direccion: form.direccion || undefined,
        tutorNombre: form.tutorNombre || undefined,
        tutorTelefono: form.tutorTelefono || undefined,
      });
      setMensaje(editando ? `Expediente de ${form.matricula} actualizado.` : `Expediente de ${form.matricula} registrado. Control Escolar debe continuar con Apertura de cartera.`);
      setEditando(null);
      setForm(FORM_INICIAL);
      trabajo.guardado();
      if (modo === 'legado') recargarListado(); else trabajo.ir('consulta');
    } catch (err) { setError(mensajeDeError(err)); } finally { setEnviando(false); }
  };

  const dar = (campo: Exclude<keyof typeof FORM_INICIAL, 'plantelId'>) => ({
    value: form[campo],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [campo]: e.target.value }),
  });

  const baja = async (alumno: Alumno) => {
    if (!await confirmacion.solicitar(`¿Dar de baja a ${alumno.usuario.nombre} ${alumno.usuario.apellidoPaterno}?`)) return;
    setEnviando(true); setError('');
    try { await api.post(`/alumnos/${alumno.id}/baja`); setMensaje('Alumno dado de baja'); recargarListado(); }
    catch (err) { setError(mensajeDeError(err)); } finally { setEnviando(false); }
  };

  /** Descarga la boleta PDF con el token de sesión y la abre en otra pestaña. */
  const boleta = async (alumno: Alumno, cicloId?: number, inscripcionId?: number) => {
    setError('');
    try {
      const { data } = await api.get(`/reportes/boleta/${alumno.id}`, { responseType: 'blob', params: { cicloId, inscripcionId } });
      const url = URL.createObjectURL(data);
      window.open(url, '_blank', 'noopener');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) { setError(mensajeDeError(err)); }
  };

  return (
    <>{confirmacion.elemento}{dialogoMotivo.elemento}
      <Encabezado titulo="Alumnos" detalle="Alta, consulta, boletas y baja de expedientes" />
      {(puedeGestionar || puedeCrear) && <p className="texto-ayuda">Recorrido recomendado: registra el expediente y continúa con Apertura de cartera para el contexto académico, asignación de grupo y cargos. Crear la matrícula no equivale a inscribir.</p>}

      {mostrarFormulario && <FormularioAlumno editando={editando} crear={crear} enviando={enviando} form={form} setForm={setForm} planteles={planteles} dar={dar} setEditando={setEditando} cancelar={modo === 'legado' ? undefined : () => trabajo.ir('consulta')} error={error} mensaje={mensaje} />}
      {!puedeGestionar && error && <p role="alert" className="mensaje-error">{error}</p>}
      {!mostrarFormulario && error && puedeGestionar && <p role="alert">{error}</p>}
      {!mostrarFormulario && mensaje && <p role="status">{mensaje}</p>}
      {consultaVisible && <>{historial && <HistorialAlumno key={`${historial.alumno.id}-${historial.pagina}`} historial={historial} boleta={boleta} cargandoNotas={cargandoNotas} verNotas={verNotas} notas={notas} setHistorial={(valor) => { historialSolicitud.current++; invalidarNotas(); setHistorialCargando(false); setHistorial(valor); }} cargando={historialCargando} cambiarPagina={(pagina) => void verHistorial(historial.alumno, pagina)} />}
      {transferencia && <TransferirAlumno transferencia={transferencia} transferir={transferir} destino={destino} setDestino={setDestino} planteles={planteles} enviando={enviando} setTransferencia={setTransferencia} />}

      <div className="fila" role="group" aria-label="Sección de expedientes">
        <button type="button" className="boton secundario" aria-pressed={!vistaEgresados} disabled={cargando} onClick={() => { filtroEgresados.current = false; setVistaEgresados(false); consultar(1, filtrosAplicados.current.buscar, filtrosAplicados.current.plantelId); }}>Alumnos</button>
        <button type="button" className="boton secundario" aria-pressed={vistaEgresados} disabled={cargando} onClick={() => { filtroEgresados.current = true; setVistaEgresados(true); consultar(1, filtrosAplicados.current.buscar, filtrosAplicados.current.plantelId); }}>Alumnos egresados</button>
      </div>
      <section className="panel panel-filtros" aria-label="Filtros de alumnos"><div className="fila">
        <div className="campo"><label htmlFor="alumnos-campo-11">Filtrar por plantel</label>
          <select id="alumnos-campo-11" value={plantelId} onChange={(e) => setPlantelId(e.target.value)}>
            <option value="">Todos</option>
            {planteles.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
        </div>
        <div className="campo">
          <label htmlFor="alumnos-campo-12">Buscar por matrícula</label>
          <input id="alumnos-campo-12"
            type="search"
            placeholder="Escribe la matrícula"
            value={buscar}
            onChange={(e) => setBuscar(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && cargar(1, buscar.trim(), plantelId)}
          />
        </div>
        <button type="button" className="boton" disabled={cargando} onClick={() => cargar(1, buscar.trim(), plantelId)}>Buscar</button>
        {(busquedaAplicada || plantelAplicado || buscar || plantelId) && <button type="button" className="boton secundario" onClick={() => { setBuscar(''); setPlantelId(''); cargar(1, '', ''); }}>Limpiar filtros</button>}
      </div></section>

      {mensaje.includes('registrado') && <p>{puedeAbrirCartera ? <Link className="boton secundario" to="/apertura-cartera/nueva">Continuar con apertura de cartera</Link> : 'Control Escolar debe completar la apertura de cartera. Finanzas no asigna grupos desde este módulo.'}</p>}
      <div className="cabecera-listado"><h2>{vistaEgresados ? "Expedientes de egresados" : "Expedientes de alumnos"}</h2><p>{resultado.total} registros encontrados</p></div>
      <div className="tabla-contenedor" role="region" aria-label="Listado de alumnos" tabIndex={0}>
      <table className="tabla tabla-adaptable" aria-busy={cargando}>
        <caption className="solo-lector">Alumnos, plantel, correo y acciones disponibles</caption>
        <thead>
          <tr><th scope="col">Matrícula</th><th scope="col">Nombre</th><th scope="col">Plantel</th><th scope="col">Correo</th><th scope="col">Estatus</th><th scope="col" className="derecha">Acciones</th></tr>
        </thead>
        <tbody>
          {resultado.datos.map((a) => (
            <tr key={a.id}>
              <td data-etiqueta="Matrícula">{a.matricula}</td>
              <td data-etiqueta="Nombre">{a.usuario.nombre} {a.usuario.apellidoPaterno} {a.usuario.apellidoMaterno ?? ''}</td>
              <td data-etiqueta="Plantel">{a.plantel?.nombre ?? <span className="sello neutro">Sin plantel</span>}</td>
              <td data-etiqueta="Correo">{a.usuario.email}</td>
              <td data-etiqueta="Estatus"><span className={`sello ${a.estatus === 'ACTIVO' ? 'ok' : 'neutro'}`}>{a.estatus}</span></td>
              <td data-etiqueta="Acciones" className="derecha">
                <span className="acciones-fila"><EliminarRegistro ruta={`/alumnos/${a.id}`} nombre={`alumno ${a.matricula}`} deshabilitado={enviando} alEliminar={() => { setEditando(null); setForm(FORM_INICIAL); historialSolicitud.current++; invalidarNotas(); setHistorial(null); setTransferencia(null); setMensaje('Alumno y cuenta eliminados definitivamente'); recargarListado(); }} />
                  {puedeGestionar && <><button className="boton secundario chico" onClick={() => verHistorial(a)}>Historial y boleta</button><Link className="boton secundario chico" to={`/recursamientos/nuevo?alumno=${a.id}&plantel=${a.plantel?.id || ''}`}>Recursar materia</Link></>}
                  {puedeGestionar && <>
                    <button disabled={enviando} className="boton secundario chico" onClick={() => editar(a)}>Editar</button>
                    {a.estatus === 'BAJA' && <button disabled={enviando} onClick={() => dialogoMotivo.abrir({ titulo: 'Reactivar alumno', advertencia: 'No se restauran inscripciones; deberá inscribirse explícitamente.', ejecutar: async (motivo) => { await api.post(`/alumnos/${a.id}/reactivacion`, { motivo }); setMensaje('Alumno reactivado; inscribe desde Grupos'); recargarListado(); } })}>Reactivar expediente</button>}
                    {a.estatus === 'ACTIVO' && <>
                      <button disabled={enviando} className="boton secundario chico" onClick={() => { setTransferencia(a); setDestino(''); }}>Transferir</button>
                      <button disabled={enviando} className="boton secundario chico" onClick={() => egresar(a)}>Egresar</button>
                      <button disabled={enviando} className="boton peligro chico" onClick={() => baja(a)}>Dar de baja</button>
                    </>}
                  </>}
                </span>
              </td>
            </tr>
          ))}
          {!cargando && resultado.datos.length === 0 && (
            <tr><td className="vacio" colSpan={6}>{busquedaAplicada || plantelAplicado ? 'No se encontraron alumnos con estos filtros. Prueba con otra matrícula o plantel.' : vistaEgresados ? 'Todavía no hay alumnos egresados registrados.' : 'Todavía no hay alumnos registrados. Puedes dar de alta al primero desde el formulario.'}</td></tr>
          )}
          {cargando && <tr><td className="vacio" colSpan={6}>Cargando…</td></tr>}
        </tbody>
      </table></div>
      <Paginador deshabilitado={cargando} total={resultado.total} pagina={resultado.pagina} porPagina={resultado.porPagina} onCambio={(pagina) => cargar(pagina, busquedaAplicada, plantelAplicado)} />
      </>}
    </>
  );
}
