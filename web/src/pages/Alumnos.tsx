import { FormEvent, useCallback, useEffect, useState } from 'react';
import { api, mensajeDeError } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { Encabezado } from '../components/Encabezado';
import { Paginador } from '../components/Paginador';

interface Alumno {
  id: number;
  matricula: string;
  estatus: string;
  usuario: { nombre: string; apellidoPaterno: string; apellidoMaterno?: string; email: string };
  plantel: { id: number; nombre: string } | null;
}
interface Historial { id: number; estatus: string; grupo: { id: number; nombre: string; ciclo: { id: number; nombre: string }; plantel: { nombre: string } } }
interface Nota { id: number; parcial: number; calificacion: number; promedioOficial: number | null; grupoMateria: { id: number; grupo: { id: number }; materia: { nombre: string } } }
interface Plantel { id: number; nombre: string }
interface Resultado { datos: Alumno[]; total: number; pagina: number; porPagina: number }

const FORM_INICIAL = {
  matricula: '', nombre: '', apellidoPaterno: '', apellidoMaterno: '',
  email: '', password: '', curp: '', tutorNombre: '', tutorTelefono: '', plantelId: '',
};

export default function AlumnosPage() {
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
    setError('');
    try {
      const { data } = await api.get(`/alumnos/${alumno.id}`);
      setForm({ ...FORM_INICIAL, matricula: data.matricula, plantelId: String(data.plantelId),
        ...data.usuario, email: data.usuario.email, password: '', curp: data.curp ?? '',
        tutorNombre: data.tutorNombre ?? '', tutorTelefono: data.tutorTelefono ?? '' });
      setEditando(alumno.id);
      document.getElementById('form-alumno')?.scrollIntoView();
    } catch (err) { setError(mensajeDeError(err)); }
  };
  const egresar = async (alumno: Alumno) => {
    if (!confirm('¿Egresar al alumno? Se terminarán sus inscripciones y su acceso; conservará el expediente.')) return;
    setEnviando(true); setError('');
    try { await api.post(`/alumnos/${alumno.id}/egreso`); setMensaje('Alumno egresado'); cargar(1, buscar, plantelId); }
    catch (err) { setError(mensajeDeError(err)); } finally { setEnviando(false); }
  };
  const transferir = async (e: FormEvent) => {
    e.preventDefault();
    if (!transferencia || !confirm('¿Transferir? Se darán de baja las inscripciones anteriores. Deberás inscribirlo en el grupo del nuevo plantel.')) return;
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
    if (!confirm(`¿Dar de baja a ${alumno.usuario.nombre} ${alumno.usuario.apellidoPaterno}?`)) return;
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
    <>
      <Encabezado titulo="Alumnos" detalle="Alta, consulta, boletas y baja de expedientes" />

      {puedeGestionar && <section className="panel" id="form-alumno">
        <h2>{editando ? 'Editar alumno' : 'Registrar alumno'}</h2>
        <form onSubmit={crear}>
          <div className="fila">
            <div className="campo"><label>Plantel</label>
              <select required disabled={editando !== null || enviando} value={form.plantelId} onChange={(e) => setForm({ ...form, plantelId: e.target.value })}>
                <option value="">Selecciona…</option>
                {planteles.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
            </div>
            <div className="campo"><label>Matrícula</label><input required disabled={editando !== null} {...dar('matricula')} /></div>
            <div className="campo"><label>Nombre</label><input required {...dar('nombre')} /></div>
            <div className="campo"><label>Apellido paterno</label><input required {...dar('apellidoPaterno')} /></div>
            <div className="campo"><label>Apellido materno</label><input {...dar('apellidoMaterno')} /></div>
            <div className="campo"><label>CURP</label><input {...dar('curp')} /></div>
          </div>
          <div className="fila" style={{ marginTop: 10 }}>
            <div className="campo"><label>Correo</label><input type="email" required disabled={editando !== null} {...dar('email')} /></div>
            {!editando && <div className="campo"><label>Contraseña inicial</label><input type="password" autoComplete="new-password" required minLength={8} {...dar('password')} /></div>}
            <div className="campo"><label>Tutor</label><input {...dar('tutorNombre')} /></div>
            <div className="campo"><label>Tel. tutor</label><input {...dar('tutorTelefono')} /></div>
            <button className="boton" disabled={enviando}>{enviando ? 'Guardando…' : 'Guardar alumno'}</button>
            {editando && <button type="button" className="boton secundario" onClick={() => { setEditando(null); setForm(FORM_INICIAL); }}>Cancelar edición</button>}
          </div>
        </form>
        {error && <p className="mensaje-error">{error}</p>}
        {mensaje && <p className="mensaje-ok">{mensaje}</p>}
      </section>}
      {!puedeGestionar && error && <p role="alert" className="mensaje-error">{error}</p>}
      {historial && <section className="panel"><h2>Historial de {historial.alumno.matricula}</h2>
        {historial.registros.map((i) => <p key={i.id}>{i.grupo.ciclo.nombre} · {i.grupo.nombre} · {i.grupo.plantel.nombre} · {i.estatus}
          <button onClick={() => boleta(historial.alumno, i.grupo.ciclo.id, i.id)}>Boleta de esta inscripción</button>
          <button disabled={cargandoNotas} onClick={() => verNotas(historial.alumno, i)}>Ver calificaciones</button></p>)}
        {cargandoNotas && <p role="status">Cargando calificaciones…</p>}
        {notas && <table className="tabla"><thead><tr><th>Materia</th><th>Parcial</th><th>Nota</th><th>Promedio oficial P1-P3</th></tr></thead>
          <tbody>{notas.map((n) => <tr key={n.id}><td>{n.grupoMateria.materia.nombre}</td><td>{n.parcial === 0 ? 'Final' : `P${n.parcial}`}</td><td>{n.calificacion}</td><td>{n.promedioOficial ?? 'Pendiente'}</td></tr>)}</tbody></table>}
        {notas?.length === 0 && <p>Sin calificaciones en esta inscripción.</p>}
        {!historial.registros.length && <p>Sin inscripciones registradas.</p>}<button onClick={() => setHistorial(null)}>Cerrar historial</button>
      </section>}
      {transferencia && <section className="panel"><h2>Transferir a {transferencia.usuario.nombre}</h2>
        <form onSubmit={transferir}><label htmlFor="destino">Plantel de destino</label>
          <select id="destino" required value={destino} onChange={(e) => setDestino(e.target.value)}>
            <option value="">Selecciona…</option>{planteles.filter((p) => p.id !== transferencia.plantel?.id).map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select><button disabled={enviando} className="boton">Confirmar transferencia</button>
          <button type="button" onClick={() => setTransferencia(null)}>Cancelar</button>
        </form></section>}

      <div className="fila" style={{ marginBottom: 12 }}>
        <div className="campo"><label>Filtrar por plantel</label>
          <select value={plantelId} onChange={(e) => setPlantelId(e.target.value)}>
            <option value="">Todos</option>
            {planteles.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
        </div>
        <div className="campo">
          <label>Buscar por matrícula</label>
          <input
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
                    {a.estatus === 'BAJA' && <button disabled={enviando} onClick={async () => { const motivo = prompt('Motivo de reactivación. No se restauran inscripciones; deberá inscribirse explícitamente.'); if (!motivo?.trim() || enviando) return; setEnviando(true); setError(''); try { await api.post(`/alumnos/${a.id}/reactivacion`, { motivo }); setMensaje('Alumno reactivado; inscribe desde Grupos'); await cargar(1, buscar, plantelId); } catch (err) { setError(mensajeDeError(err)); } finally { setEnviando(false); } }}>Reactivar expediente</button>}
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
