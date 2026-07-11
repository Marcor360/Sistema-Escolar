import { FormEvent, useEffect, useState } from 'react';
import { api, mensajeDeError } from '../api/client';
import { Encabezado } from '../components/Encabezado';

interface Alumno {
  id: number;
  matricula: string;
  estatus: string;
  usuario: { nombre: string; apellidoPaterno: string; apellidoMaterno?: string; email: string };
  plantel: { id: number; nombre: string } | null;
}
interface Plantel { id: number; nombre: string }

const FORM_INICIAL = {
  matricula: '', nombre: '', apellidoPaterno: '', apellidoMaterno: '',
  email: '', password: '', curp: '', tutorNombre: '', tutorTelefono: '', plantelId: '',
};

export default function AlumnosPage() {
  const [alumnos, setAlumnos] = useState<Alumno[]>([]);
  const [planteles, setPlanteles] = useState<Plantel[]>([]);
  const [plantelId, setPlantelId] = useState('');
  const [cargando, setCargando] = useState(true);
  const [buscar, setBuscar] = useState('');
  const [form, setForm] = useState(FORM_INICIAL);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');

  const cargar = (termino = buscar) => {
    setCargando(true);
    api.get<Alumno[]>('/alumnos', {
      params: { ...(termino ? { buscar: termino } : {}), ...(plantelId ? { plantelId } : {}) },
    })
      .then((r) => setAlumnos(r.data))
      .catch((err) => setError(mensajeDeError(err)))
      .finally(() => setCargando(false));
  };

  useEffect(() => {
    api.get<Plantel[]>('/planteles/mios').then((r) => setPlanteles(r.data));
    cargar('');
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const crear = async (e: FormEvent) => {
    e.preventDefault();
    setError(''); setMensaje('');
    try {
      await api.post('/alumnos', {
        ...form,
        plantelId: Number(form.plantelId),
        apellidoMaterno: form.apellidoMaterno || undefined,
        curp: form.curp || undefined,
        tutorNombre: form.tutorNombre || undefined,
        tutorTelefono: form.tutorTelefono || undefined,
      });
      setMensaje(`Alumno ${form.matricula} registrado`);
      setForm(FORM_INICIAL);
      cargar();
    } catch (err) { setError(mensajeDeError(err)); }
  };

  const dar = (campo: Exclude<keyof typeof FORM_INICIAL, 'plantelId'>) => ({
    value: form[campo],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [campo]: e.target.value }),
  });

  const baja = async (alumno: Alumno) => {
    if (!confirm(`¿Dar de baja a ${alumno.usuario.nombre} ${alumno.usuario.apellidoPaterno}?`)) return;
    await api.delete(`/alumnos/${alumno.id}`);
    cargar();
  };

  /** Descarga la boleta PDF con el token de sesión y la abre en otra pestaña. */
  const boleta = async (alumno: Alumno) => {
    setError('');
    try {
      const { data } = await api.get(`/reportes/boleta/${alumno.id}`, { responseType: 'blob' });
      const url = URL.createObjectURL(data);
      window.open(url, '_blank', 'noopener');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) { setError(mensajeDeError(err)); }
  };

  return (
    <>
      <Encabezado titulo="Alumnos" detalle="Alta, consulta, boletas y baja de expedientes" />

      <section className="panel">
        <h2>Registrar alumno</h2>
        <form onSubmit={crear}>
          <div className="fila">
            <div className="campo"><label>Plantel</label>
              <select required value={form.plantelId} onChange={(e) => setForm({ ...form, plantelId: e.target.value })}>
                <option value="">Selecciona…</option>
                {planteles.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
            </div>
            <div className="campo"><label>Matrícula</label><input required {...dar('matricula')} /></div>
            <div className="campo"><label>Nombre</label><input required {...dar('nombre')} /></div>
            <div className="campo"><label>Apellido paterno</label><input required {...dar('apellidoPaterno')} /></div>
            <div className="campo"><label>Apellido materno</label><input {...dar('apellidoMaterno')} /></div>
            <div className="campo"><label>CURP</label><input {...dar('curp')} /></div>
          </div>
          <div className="fila" style={{ marginTop: 10 }}>
            <div className="campo"><label>Correo</label><input type="email" required {...dar('email')} /></div>
            <div className="campo"><label>Contraseña inicial</label><input required minLength={8} {...dar('password')} /></div>
            <div className="campo"><label>Tutor</label><input {...dar('tutorNombre')} /></div>
            <div className="campo"><label>Tel. tutor</label><input {...dar('tutorTelefono')} /></div>
            <button className="boton">Guardar alumno</button>
          </div>
        </form>
        {error && <p className="mensaje-error">{error}</p>}
        {mensaje && <p className="mensaje-ok">{mensaje}</p>}
      </section>

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
            onKeyDown={(e) => e.key === 'Enter' && cargar()}
          />
        </div>
        <button className="boton secundario" onClick={() => cargar()}>Buscar</button>
      </div>

      <table className="tabla">
        <thead>
          <tr><th>Matrícula</th><th>Nombre</th><th>Plantel</th><th>Correo</th><th>Estatus</th><th className="derecha">Acciones</th></tr>
        </thead>
        <tbody>
          {alumnos.map((a) => (
            <tr key={a.id}>
              <td>{a.matricula}</td>
              <td>{a.usuario.nombre} {a.usuario.apellidoPaterno} {a.usuario.apellidoMaterno ?? ''}</td>
              <td>{a.plantel?.nombre ?? <span className="sello neutro">Sin plantel</span>}</td>
              <td>{a.usuario.email}</td>
              <td><span className={`sello ${a.estatus === 'ACTIVO' ? 'ok' : 'neutro'}`}>{a.estatus}</span></td>
              <td className="derecha">
                <span className="acciones-fila">
                  <button className="boton secundario chico" onClick={() => boleta(a)}>Boleta PDF</button>
                  <button className="boton peligro chico" onClick={() => baja(a)}>Baja</button>
                </span>
              </td>
            </tr>
          ))}
          {!cargando && alumnos.length === 0 && (
            <tr><td className="vacio" colSpan={6}>Sin alumnos registrados. Usa el formulario para dar de alta al primero.</td></tr>
          )}
          {cargando && <tr><td className="vacio" colSpan={6}>Cargando…</td></tr>}
        </tbody>
      </table>
    </>
  );
}
