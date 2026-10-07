import { FormEvent, useCallback, useEffect, useState } from 'react';
import { api, mensajeDeError } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { Encabezado } from '../components/Encabezado';
import { Paginador } from '../components/Paginador';

type Tipo = 'ALUMNO' | 'DOCENTE' | 'ADMINISTRATIVO';
interface Plantel { id: number; nombre: string }
interface Fila {
  id: number; matricula?: string; numEmpleado?: string; nombre: string; correo?: string;
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
  const [editarId, setEditarId] = useState<number | null>(null); const [activo, setActivo] = useState(true);
  const [tipo, setTipo] = useState<Tipo>('ALUMNO');
  const [resultado, setResultado] = useState<Resultado>({ datos: [], total: 0, pagina: 1, porPagina: 20 });
  const [planteles, setPlanteles] = useState<Plantel[]>([]);
  const [plantelId, setPlantelId] = useState('');
  const [plantelIds, setPlantelIds] = useState<number[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [buscar, setBuscar] = useState('');
  const [form, setForm] = useState(FORM_INICIAL);
  const [rolesElegidos, setRolesElegidos] = useState<string[]>(['ADMINISTRATIVO']);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');

  const cargar = useCallback(async (pagina = 1, tipoActual: Tipo = 'ALUMNO', plantelActual = '', termino = '') => {
    setError('');
    try {
      const { data } = await api.get<Resultado>('/usuarios/listado', {
        params: { tipo: tipoActual, pagina, porPagina: 20, ...(plantelActual ? { plantelId: plantelActual } : {}), ...(termino ? { buscar: termino } : {}) },
      });
      setResultado(data);
    } catch (err) { setError(mensajeDeError(err)); }
  }, []);
  useEffect(() => {
    api.get<Plantel[]>('/planteles/mios').then((r) => setPlanteles(r.data)).catch((err) => setError(mensajeDeError(err)));
    cargar(1, 'ALUMNO', '', '');
  }, [cargar]);

  const cambiarTipo = (nuevo: Tipo) => {
    setTipo(nuevo); setResultado({ datos: [], total: 0, pagina: 1, porPagina: 20 });
    cargar(1, nuevo, plantelId, buscar);
  };
  const alternarRol = (rol: string) => setRolesElegidos((r) => r.includes(rol) ? r.filter((x) => x !== rol) : [...r, rol]);
  const crear = async (e: FormEvent) => {
    e.preventDefault(); if (enviando) return; setEnviando(true); setError(''); setMensaje('');
    try {
      if (editarId) await api.patch(`/usuarios/${editarId}/personal`, { nombre: form.nombre, apellidoPaterno: form.apellidoPaterno, ...(form.password ? { password: form.password } : {}), roles: rolesElegidos, plantelIds, activo });
      else await api.post('/usuarios', { ...form, roles: rolesElegidos, plantelIds: plantelIds.length ? plantelIds : undefined });
      setMensaje(`Cuenta ${form.email} ${editarId ? 'actualizada' : 'creada'}`); setForm(FORM_INICIAL); setEditarId(null); await cargar(1, tipo, plantelId, buscar);
    } catch (err) { setError(mensajeDeError(err)); } finally { setEnviando(false); }
  };

  return <>
    <Encabezado titulo="Usuarios" detalle="Consulta de alumnos, docentes y personal según tu alcance" />
    {esSuperadmin && <section className="panel"><h2>{editarId ? 'Corregir cuenta de personal' : 'Crear cuenta de personal'}</h2>
      <form onSubmit={crear}><div className="fila">
        <div className="campo"><label>Nombre</label><input required value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} /></div>
        <div className="campo"><label>Apellido paterno</label><input required value={form.apellidoPaterno} onChange={(e) => setForm({ ...form, apellidoPaterno: e.target.value })} /></div>
        <div className="campo"><label>Correo</label><input type="email" disabled={editarId !== null} required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
        <div className="campo"><label>{editarId ? 'Nueva contraseña temporal (opcional)' : 'Contraseña temporal'}</label><input type="password" autoComplete="new-password" required={editarId === null} minLength={8} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div>
      </div><div className="fila" style={{ marginTop: 12 }}>{ROLES_PERSONAL.map((rol) => <label className="casilla" key={rol}><input type="checkbox" checked={rolesElegidos.includes(rol)} onChange={() => alternarRol(rol)} />{rol}</label>)}<button disabled={enviando} className="boton">{enviando ? 'Guardando…' : editarId ? 'Guardar corrección' : 'Crear'}</button></div><fieldset><legend>Planteles de alcance</legend>{planteles.map((p) => <label key={p.id} className="casilla">
        <input type="checkbox" checked={plantelIds.includes(p.id)} onChange={() => setPlantelIds((ids) => ids.includes(p.id) ? ids.filter((id) => id !== p.id) : [...ids, p.id])} />{p.nombre}
      </label>)}</fieldset>{editarId && <><label><input type="checkbox" checked={activo} onChange={(e) => setActivo(e.target.checked)} />Cuenta activa</label><button type="button" onClick={() => { setEditarId(null); setForm(FORM_INICIAL); }}>Cancelar edición</button></>}<p>La contraseña temporal exige cambio al ingresar. Las correcciones de roles, planteles o acceso revocan las sesiones anteriores.</p></form>
    </section>}
    {error && <p className="mensaje-error">{error}</p>}{mensaje && <p className="mensaje-ok">{mensaje}</p>}

    <div className="fila" style={{ marginBottom: 14 }}>
      {(['ALUMNO', ...(maestroPuro ? [] : ['DOCENTE', 'ADMINISTRATIVO'])] as Tipo[]).map((t) => <button key={t} className={`boton ${tipo === t ? '' : 'secundario'}`} onClick={() => cambiarTipo(t)}>{t === 'ADMINISTRATIVO' ? 'Personal' : t === 'DOCENTE' ? 'Docentes' : 'Alumnos'}</button>)}
    </div>
    <div className="fila" style={{ marginBottom: 14 }}>
      <div className="campo"><label>Plantel</label><select value={plantelId} onChange={(e) => setPlantelId(e.target.value)}><option value="">Todos</option>{planteles.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}</select></div>
      <div className="campo"><label>Buscar</label><input value={buscar} onChange={(e) => setBuscar(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && cargar(1, tipo, plantelId, buscar)} /></div>
      <button className="boton secundario" onClick={() => cargar(1, tipo, plantelId, buscar)}>Aplicar</button>
    </div>

    <table className="tabla"><thead><tr><th>Identificador</th><th>Nombre</th><th>Correo</th><th>Plantel(es)</th><th>Roles/Estatus</th></tr></thead><tbody>
      {resultado.datos.map((fila) => <tr key={fila.id}><td>{fila.matricula ?? fila.numEmpleado ?? fila.id}</td><td>{fila.nombre}</td><td>{fila.correo ?? 'Restringido'}</td><td>{fila.plantel ?? fila.planteles?.join(', ') ?? '—'}</td><td>{fila.roles?.join(', ') ?? fila.estatus ?? (fila.activo ? 'ACTIVO' : 'INACTIVO')}{esSuperadmin && tipo === 'ADMINISTRATIVO' && <button disabled={enviando} onClick={async () => { try { const { data } = await api.get(`/usuarios/${fila.id}/personal`); setEditarId(data.id); setActivo(data.activo); setPlantelIds(data.plantelIds); setRolesElegidos(data.roles.map((r: { clave: string }) => r.clave)); setForm({ email: data.email, password: '', nombre: data.nombre, apellidoPaterno: data.apellidoPaterno }); } catch (err) { setError(mensajeDeError(err)); } }}>Corregir cuenta</button>}</td></tr>)}
      {!resultado.datos.length && <tr><td className="vacio" colSpan={5}>Sin resultados.</td></tr>}
    </tbody></table>
    <Paginador total={resultado.total} pagina={resultado.pagina} porPagina={resultado.porPagina} onCambio={(pagina) => cargar(pagina, tipo, plantelId, buscar)} />
  </>;
}
