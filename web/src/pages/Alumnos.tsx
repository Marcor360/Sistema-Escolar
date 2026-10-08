import { FORM_INICIAL } from '../features/alumnos/tipos';
import { FormularioAlumno } from '../features/alumnos/FormularioAlumno';
import { HistorialAlumno } from '../features/alumnos/HistorialAlumno';
import { TransferirAlumno } from '../features/alumnos/TransferirAlumno';
import type { Alumno, Historial, Nota, Plantel, Resultado } from '../features/alumnos/tipos';
import { useConfirmacion } from '../components/useConfirmacion';
import { useDialogoMotivo } from '../components/useDialogoMotivo';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { api, mensajeDeError } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { Encabezado } from '../components/Encabezado';
import { Paginador } from '../components/Paginador';









export default function AlumnosPage() {
  const confirmacion = useConfirmacion();
  const dialogoMotivo = useDialogoMotivo();
  const [resultado, setResultado] = useState<Resultado>({ datos: [], total: 0, pagina: 1, porPagina: 20 });
  const [planteles, setPlanteles] = useState<Plantel[]>([]);
  const [plantelId, setPlantelId] = useState('');
  const [cargando, setCargando] = useState(true);
  const [buscar, setBuscar] = useState('');
  const [form, setForm] = useState(FORM_INICIAL);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const { tieneRol } = useAuth();
  const puedeGestionar = tieneRol('ADMINISTRATIVO');
  const [editando, setEditando] = useState<number | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [transferencia, setTransferencia] = useState<Alumno | null>(null);
  const [destino, setDestino] = useState('');
  const [historial, setHistorial] = useState<{ alumno: Alumno; registros: Historial[] } | null>(null);
  const [notas, setNotas] = useState<Nota[] | null>(null);
  const [cargandoNotas, setCargandoNotas] = useState(false);
  const verNotas = async (alumno: Alumno, inscripcion: Historial) => {
    setCargandoNotas(true); setNotas(null); setError('');
    try {
      const { data } = await api.get<Nota[]>(`/calificaciones/alumno/${alumno.id}`, { params: { cicloId: inscripcion.grupo.ciclo.id } });
      setNotas(data.filter((n) => n.grupoMateria.grupo.id === inscripcion.grupo.id));
    } catch (err) { setError(mensajeDeError(err)); } finally { setCargandoNotas(false); }
  };
  const verHistorial = async (alumno: Alumno) => {
    try { const { data } = await api.get<Historial[]>(`/alumnos/${alumno.id}/historial`); setHistorial({ alumno, registros: data }); setNotas(null); }
    catch (err) { setError(mensajeDeError(err)); }
  };
  const editar = async (alumno: Alumno) => {
    if (enviando) return;
    setEnviando(true); setError('');
    try {
      const { data } = await api.get(`/alumnos/${alumno.id}`);
      setForm({ ...FORM_INICIAL, matricula: data.matricula, plantelId: String(data.plantelId),
        ...data.usuario, email: data.usuario.email, password: '', curp: data.curp ?? '',
        tutorNombre: data.tutorNombre ?? '', tutorTelefono: data.tutorTelefono ?? '' });
      setEditando(alumno.id);
      document.getElementById('form-alumno')?.scrollIntoView();
    } catch (err) { setError(mensajeDeError(err)); } finally { setEnviando(false); }
  };
  const egresar = async (alumno: Alumno) => {
    if (!await confirmacion.solicitar('¿Egresar al alumno? Se terminarán sus inscripciones y su acceso; conservará el expediente.')) return;
    setEnviando(true); setError('');
    try { await api.post(`/alumnos/${alumno.id}/egreso`); setMensaje('Alumno egresado'); cargar(1, buscar, plantelId); }
    catch (err) { setError(mensajeDeError(err)); } finally { setEnviando(false); }
  };
  const transferir = async (e: FormEvent) => {
    e.preventDefault();
    if (!transferencia || !await confirmacion.solicitar('¿Transferir? Se darán de baja las inscripciones anteriores. Deberás inscribirlo en el grupo del nuevo plantel.')) return;
    setEnviando(true); setError('');
    try {
      await api.post(`/alumnos/${transferencia.id}/transferencia`, { plantelId: Number(destino) });
      setTransferencia(null); setMensaje('Transferencia completada. Inscribe al alumno en el grupo de destino.'); cargar(1, buscar, plantelId);
    } catch (err) { setError(mensajeDeError(err)); } finally { setEnviando(false); }
  };

  const cargar = useCallback((pagina = 1, termino = '', filtroPlantel = '') => {
    setCargando(true);
    setError('');
    api.get<Resultado>('/alumnos', {
      params: { pagina, ...(termino ? { buscar: termino } : {}), ...(filtroPlantel ? { plantelId: filtroPlantel } : {}) },
    })
      .then((r) => setResultado(r.data))
      .catch((err) => setError(mensajeDeError(err)))
      .finally(() => setCargando(false));
  }, []);

  useEffect(() => {
    api.get<Plantel[]>('/planteles/mios').then((r) => setPlanteles(r.data)).catch((err) => setError(mensajeDeError(err)));
    cargar(1, '');
  }, [cargar]);

  const crear = async (e: FormEvent) => {
    e.preventDefault();
    if (enviando) return;
    setEnviando(true); setError(''); setMensaje('');
    try {
      if (editando) {
        await api.patch(`/alumnos/${editando}`, {
          nombre: form.nombre, apellidoPaterno: form.apellidoPaterno, apellidoMaterno: form.apellidoMaterno,
          curp: form.curp, tutorNombre: form.tutorNombre, tutorTelefono: form.tutorTelefono,
        });
      } else await api.post('/alumnos', {
        ...form,
        plantelId: Number(form.plantelId),
        apellidoMaterno: form.apellidoMaterno || undefined,
        curp: form.curp || undefined,
        tutorNombre: form.tutorNombre || undefined,
        tutorTelefono: form.tutorTelefono || undefined,
      });
      setMensaje(`Alumno ${form.matricula} ${editando ? 'actualizado' : 'registrado'}`);
      setEditando(null);
      setForm(FORM_INICIAL);
      cargar(1, buscar, plantelId);
    } catch (err) { setError(mensajeDeError(err)); } finally { setEnviando(false); }
  };

  const dar = (campo: Exclude<keyof typeof FORM_INICIAL, 'plantelId'>) => ({
    value: form[campo],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [campo]: e.target.value }),
  });

  const baja = async (alumno: Alumno) => {
    if (!await confirmacion.solicitar(`¿Dar de baja a ${alumno.usuario.nombre} ${alumno.usuario.apellidoPaterno}?`)) return;
    setEnviando(true); setError('');
    try { await api.post(`/alumnos/${alumno.id}/baja`); setMensaje('Alumno dado de baja'); cargar(1, buscar, plantelId); }
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

      {puedeGestionar && <FormularioAlumno editando={editando} crear={crear} enviando={enviando} form={form} setForm={setForm} planteles={planteles} dar={dar} setEditando={setEditando} error={error} mensaje={mensaje} />}
      {!puedeGestionar && error && <p role="alert" className="mensaje-error">{error}</p>}
      {historial && <HistorialAlumno historial={historial} boleta={boleta} cargandoNotas={cargandoNotas} verNotas={verNotas} notas={notas} setHistorial={setHistorial} />}
      {transferencia && <TransferirAlumno transferencia={transferencia} transferir={transferir} destino={destino} setDestino={setDestino} planteles={planteles} enviando={enviando} setTransferencia={setTransferencia} />}

      <div className="fila" style={{ marginBottom: 12 }}>
        <div className="campo"><label htmlFor="alumnos-campo-11">Filtrar por plantel</label>
          <select id="alumnos-campo-11" value={plantelId} onChange={(e) => setPlantelId(e.target.value)}>
            <option value="">Todos</option>
            {planteles.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
        </div>
        <div className="campo">
          <label htmlFor="alumnos-campo-12">Buscar por matrícula</label>
          <input id="alumnos-campo-12"
            value={buscar}
            onChange={(e) => setBuscar(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && cargar(1, buscar, plantelId)}
          />
        </div>
        <button className="boton secundario" onClick={() => cargar(1, buscar, plantelId)}>Buscar</button>
      </div>

      <table className="tabla">
        <thead>
          <tr><th>Matrícula</th><th>Nombre</th><th>Plantel</th><th>Correo</th><th>Estatus</th><th className="derecha">Acciones</th></tr>
        </thead>
        <tbody>
          {resultado.datos.map((a) => (
            <tr key={a.id}>
              <td>{a.matricula}</td>
              <td>{a.usuario.nombre} {a.usuario.apellidoPaterno} {a.usuario.apellidoMaterno ?? ''}</td>
              <td>{a.plantel?.nombre ?? <span className="sello neutro">Sin plantel</span>}</td>
              <td>{a.usuario.email}</td>
              <td><span className={`sello ${a.estatus === 'ACTIVO' ? 'ok' : 'neutro'}`}>{a.estatus}</span></td>
              <td className="derecha">
                <span className="acciones-fila">
                  {puedeGestionar && <button className="boton secundario chico" onClick={() => verHistorial(a)}>Historial y boleta</button>}
                  {puedeGestionar && <>
                    <button disabled={enviando} className="boton secundario chico" onClick={() => editar(a)}>Editar</button>
                    {a.estatus === 'BAJA' && <button disabled={enviando} onClick={() => dialogoMotivo.abrir({ titulo: 'Reactivar alumno', advertencia: 'No se restauran inscripciones; deberá inscribirse explícitamente.', ejecutar: async (motivo) => { await api.post(`/alumnos/${a.id}/reactivacion`, { motivo }); setMensaje('Alumno reactivado; inscribe desde Grupos'); await cargar(1, buscar, plantelId); } })}>Reactivar expediente</button>}
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
            <tr><td className="vacio" colSpan={6}>Sin alumnos registrados. Usa el formulario para dar de alta al primero.</td></tr>
          )}
          {cargando && <tr><td className="vacio" colSpan={6}>Cargando…</td></tr>}
        </tbody>
      </table>
      <Paginador total={resultado.total} pagina={resultado.pagina} porPagina={resultado.porPagina} onCambio={(pagina) => cargar(pagina, buscar, plantelId)} />
    </>
  );
}
