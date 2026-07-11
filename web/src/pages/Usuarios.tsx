import { FormEvent, useEffect, useState } from 'react';
import { api, mensajeDeError } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { Encabezado } from '../components/Encabezado';

type Tipo = 'ALUMNO' | 'DOCENTE' | 'ADMINISTRATIVO';
interface Plantel { id: number; nombre: string }
interface Fila {
  id: number; matricula?: string; numEmpleado?: string; nombre: string; correo: string;
  plantel?: string | null; planteles?: string[]; estatus?: string; roles?: string[]; activo?: boolean;
}
interface Resultado { datos: Fila[]; total: number; pagina: number; porPagina: number }
const ROLES_PERSONAL = ['ADMINISTRATIVO', 'FINANZAS', 'SUPERADMIN'] as const;
const FORM_INICIAL = { email: '', password: '', nombre: '', apellidoPaterno: '' };

export default function UsuariosPage() {
  const { sesion } = useAuth();
  const esSuperadmin = sesion?.roles.includes('SUPERADMIN') ?? false;
  const maestroPuro = sesion?.roles.includes('MAESTRO') &&
    !sesion.roles.some((r) => ['SUPERADMIN', 'ADMINISTRATIVO', 'FINANZAS'].includes(r));
  const [tipo, setTipo] = useState<Tipo>('ALUMNO');
  const [resultado, setResultado] = useState<Resultado>({ datos: [], total: 0, pagina: 1, porPagina: 20 });
  const [planteles, setPlanteles] = useState<Plantel[]>([]);
  const [plantelId, setPlantelId] = useState('');
  const [buscar, setBuscar] = useState('');
  const [form, setForm] = useState(FORM_INICIAL);
  const [rolesElegidos, setRolesElegidos] = useState<string[]>(['ADMINISTRATIVO']);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');

  const cargar = async (pagina = 1, tipoActual = tipo) => {
    setError('');
    try {
      const { data } = await api.get<Resultado>('/usuarios/listado', {
        params: { tipo: tipoActual, pagina, porPagina: 20, ...(plantelId ? { plantelId } : {}), ...(buscar ? { buscar } : {}) },
      });
      setResultado(data);
    } catch (err) { setError(mensajeDeError(err)); }
  };
  useEffect(() => {
    api.get<Plantel[]>('/planteles/mios').then((r) => setPlanteles(r.data));
    cargar();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const cambiarTipo = (nuevo: Tipo) => { setTipo(nuevo); setResultado({ datos: [], total: 0, pagina: 1, porPagina: 20 }); cargar(1, nuevo); };
  const alternarRol = (rol: string) => setRolesElegidos((r) => r.includes(rol) ? r.filter((x) => x !== rol) : [...r, rol]);
  const crear = async (e: FormEvent) => {
    e.preventDefault(); setError(''); setMensaje('');
    try {
      await api.post('/usuarios', { ...form, roles: rolesElegidos });
      setMensaje(`Cuenta ${form.email} creada`); setForm(FORM_INICIAL); await cargar();
    } catch (err) { setError(mensajeDeError(err)); }
  };

  return <>
    <Encabezado titulo="Usuarios" detalle="Consulta de alumnos, docentes y personal según tu alcance" />
    {esSuperadmin && <section className="panel"><h2>Crear cuenta de personal</h2>
      <form onSubmit={crear}><div className="fila">
        <div className="campo"><label>Nombre</label><input required value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} /></div>
        <div className="campo"><label>Apellido paterno</label><input required value={form.apellidoPaterno} onChange={(e) => setForm({ ...form, apellidoPaterno: e.target.value })} /></div>
        <div className="campo"><label>Correo</label><input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
        <div className="campo"><label>Contraseña inicial</label><input required minLength={8} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div>
      </div><div className="fila" style={{ marginTop: 12 }}>{ROLES_PERSONAL.map((rol) => <label className="casilla" key={rol}><input type="checkbox" checked={rolesElegidos.includes(rol)} onChange={() => alternarRol(rol)} />{rol}</label>)}<button className="boton">Crear</button></div></form>
    </section>}
    {error && <p className="mensaje-error">{error}</p>}{mensaje && <p className="mensaje-ok">{mensaje}</p>}

    <div className="fila" style={{ marginBottom: 14 }}>
      {(['ALUMNO', ...(maestroPuro ? [] : ['DOCENTE', 'ADMINISTRATIVO'])] as Tipo[]).map((t) => <button key={t} className={`boton ${tipo === t ? '' : 'secundario'}`} onClick={() => cambiarTipo(t)}>{t === 'ADMINISTRATIVO' ? 'Personal' : t === 'DOCENTE' ? 'Docentes' : 'Alumnos'}</button>)}
    </div>
    <div className="fila" style={{ marginBottom: 14 }}>
      <div className="campo"><label>Plantel</label><select value={plantelId} onChange={(e) => setPlantelId(e.target.value)}><option value="">Todos</option>{planteles.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}</select></div>
      <div className="campo"><label>Buscar</label><input value={buscar} onChange={(e) => setBuscar(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && cargar(1)} /></div>
      <button className="boton secundario" onClick={() => cargar(1)}>Aplicar</button>
    </div>

    <table className="tabla"><thead><tr><th>Identificador</th><th>Nombre</th><th>Correo</th><th>Plantel(es)</th><th>Roles/Estatus</th></tr></thead><tbody>
      {resultado.datos.map((fila) => <tr key={fila.id}><td>{fila.matricula ?? fila.numEmpleado ?? fila.id}</td><td>{fila.nombre}</td><td>{fila.correo}</td><td>{fila.plantel ?? fila.planteles?.join(', ') ?? '—'}</td><td>{fila.roles?.join(', ') ?? fila.estatus ?? (fila.activo ? 'ACTIVO' : 'INACTIVO')}</td></tr>)}
      {!resultado.datos.length && <tr><td className="vacio" colSpan={5}>Sin resultados.</td></tr>}
    </tbody></table>
    <div className="fila" style={{ marginTop: 14 }}><button className="boton secundario" disabled={resultado.pagina <= 1} onClick={() => cargar(resultado.pagina - 1)}>Anterior</button><span>{resultado.total} registros · página {resultado.pagina}</span><button className="boton secundario" disabled={resultado.pagina * resultado.porPagina >= resultado.total} onClick={() => cargar(resultado.pagina + 1)}>Siguiente</button></div>
  </>;
}
