import { FormEvent, useCallback, useEffect, useState } from 'react';
import { api, mensajeDeError } from '../api/client';
import { Encabezado } from '../components/Encabezado';
import { Paginador } from '../components/Paginador';

interface Docente {
  id: number;
  numEmpleado: string;
  especialidad?: string;
  estatus: string;
  usuario: { nombre: string; apellidoPaterno: string; email: string };
  planteles: string[];
}
interface Plantel { id: number; nombre: string }
interface Resultado { datos: Docente[]; total: number; pagina: number; porPagina: number }

const FORM_INICIAL = {
  numEmpleado: '', nombre: '', apellidoPaterno: '', email: '', password: '', especialidad: '',
};

export default function DocentesPage() {
  const [resultado, setResultado] = useState<Resultado>({ datos: [], total: 0, pagina: 1, porPagina: 20 });
  const [planteles, setPlanteles] = useState<Plantel[]>([]);
  const [plantelIds, setPlantelIds] = useState<number[]>([]);
  const [filtroPlantel, setFiltroPlantel] = useState('');
  const [form, setForm] = useState(FORM_INICIAL);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [editando, setEditando] = useState<number | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [detalle, setDetalle] = useState<{ id: number; estatus: string; plantelIds: number[]; clases: { id: number; grupo: string; materia: string; ciclo: string; plantel: string; vigente: boolean }[] } | null>(null);
  const verClases = async (d: Docente) => {
    try { const { data } = await api.get(`/docentes/${d.id}`); setDetalle(data); }
    catch (err) { setError(mensajeDeError(err)); }
  };
  const guardarPlanteles = async () => {
    if (!detalle || enviando || !confirm('¿Confirmar los planteles del docente? Las clases deben reasignarse antes de retirar un plantel.')) return;
    const motivo = detalle.estatus === 'BAJA' ? prompt('Motivo de reactivación. Las clases no se restauran automáticamente.') : undefined;
    if (detalle.estatus === 'BAJA' && !motivo?.trim()) return;
    setEnviando(true); setError('');
    try { await api.post(`/docentes/${detalle.id}/${detalle.estatus === 'BAJA' ? 'reactivacion' : 'planteles'}`, { plantelIds: detalle.plantelIds, ...(motivo ? { motivo } : {}) }); setMensaje('Planteles actualizados'); setDetalle(null); cargar(1, filtroPlantel); }
    catch (err) { setError(mensajeDeError(err)); } finally { setEnviando(false); }
  };
  const editar = (d: Docente) => {
    setEditando(d.id); setForm({ ...FORM_INICIAL, numEmpleado: d.numEmpleado,
      nombre: d.usuario.nombre, apellidoPaterno: d.usuario.apellidoPaterno,
      email: d.usuario.email, especialidad: d.especialidad ?? '' });
    document.getElementById('form-docente')?.scrollIntoView();
  };

  const cargar = useCallback((pagina = 1, plantelId = '') => {
    setError('');
    api.get<Resultado>('/docentes', { params: { pagina, ...(plantelId ? { plantelId } : {}) } })
      .then((r) => setResultado(r.data))
      .catch((err) => setError(mensajeDeError(err)));
  }, []);
  useEffect(() => {
    cargar(1, '');
    api.get<Plantel[]>('/planteles/mios').then((r) => setPlanteles(r.data)).catch((err) => setError(mensajeDeError(err)));
  }, [cargar]);

  const crear = async (e: FormEvent) => {
    e.preventDefault();
    if (enviando) return;
    setEnviando(true); setError(''); setMensaje('');
    try {
      if (editando) await api.patch(`/docentes/${editando}`, { nombre: form.nombre, apellidoPaterno: form.apellidoPaterno, especialidad: form.especialidad });
      else await api.post('/docentes', { ...form, plantelIds, especialidad: form.especialidad || undefined });
      setMensaje(editando ? 'Docente actualizado' : 'Docente registrado'); setEditando(null);
      setForm(FORM_INICIAL);
      setPlantelIds([]);
      cargar(1, filtroPlantel);
    } catch (err) { setError(mensajeDeError(err)); } finally { setEnviando(false); }
  };

  const dar = (campo: keyof typeof FORM_INICIAL) => ({
    value: form[campo],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [campo]: e.target.value }),
  });

  const baja = async (docente: Docente) => {
    if (!confirm(`¿Dar de baja al docente ${docente.numEmpleado}?`)) return;
    setEnviando(true); setError('');
    try { await api.post(`/docentes/${docente.id}/baja`); setMensaje('Docente dado de baja. Reasigna sus clases desde Grupos.'); cargar(1, filtroPlantel); }
    catch (err) { setError(mensajeDeError(err)); } finally { setEnviando(false); }
  };

  return (
    <>
      <Encabezado titulo="Docentes" detalle="Plantilla docente y cuentas de acceso" />

      <section className="panel" id="form-docente">
        <h2>{editando ? 'Editar docente' : 'Registrar docente'}</h2>
        <form onSubmit={crear}>
          <div className="fila">
            <div className="campo"><label>Núm. empleado</label><input disabled={editando !== null} required {...dar('numEmpleado')} /></div>
            <div className="campo"><label>Nombre</label><input required {...dar('nombre')} /></div>
            <div className="campo"><label>Apellido paterno</label><input required {...dar('apellidoPaterno')} /></div>
            <div className="campo"><label>Especialidad</label><input {...dar('especialidad')} /></div>
            <div className="campo"><label>Correo</label><input disabled={editando !== null} type="email" required {...dar('email')} /></div>
            {!editando && <div className="campo"><label>Contraseña inicial</label><input type="password" autoComplete="new-password" required minLength={8} {...dar('password')} /></div>}
            <button disabled={enviando} className="boton">{enviando ? 'Guardando…' : 'Guardar docente'}</button>
            {editando && <button type="button" onClick={() => { setEditando(null); setForm(FORM_INICIAL); }}>Cancelar edición</button>}
          </div>
          <div className="fila" style={{ marginTop: 12 }}>
            <span className="campo"><label>Planteles</label></span>
            {!editando && planteles.map((p) => <label className="casilla" key={p.id}><input type="checkbox" required={plantelIds.length === 0} checked={plantelIds.includes(p.id)} onChange={() => setPlantelIds((ids) => ids.includes(p.id) ? ids.filter((id) => id !== p.id) : [...ids, p.id])} />{p.nombre}</label>)}
          </div>
        </form>
        {error && <p role="alert" className="mensaje-error">{error}</p>}
        {mensaje && <p role="status" className="mensaje-ok">{mensaje}</p>}
      </section>

      <div className="fila" style={{ marginBottom: 12 }}><div className="campo"><label>Filtrar por plantel</label><select value={filtroPlantel} onChange={(e) => setFiltroPlantel(e.target.value)}><option value="">Todos</option>{planteles.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}</select></div><button className="boton secundario" onClick={() => cargar(1, filtroPlantel)}>Aplicar</button></div>

      {detalle && <section className="panel"><h2>Planteles y clases</h2><fieldset><legend>Planteles del docente</legend>
        {planteles.map((p) => <label key={p.id} className="casilla"><input type="checkbox" checked={detalle.plantelIds.includes(p.id)} onChange={() => setDetalle({ ...detalle,
          plantelIds: detalle.plantelIds.includes(p.id) ? detalle.plantelIds.filter((id) => id !== p.id) : [...detalle.plantelIds, p.id] })} />{p.nombre}</label>)}
      </fieldset><button disabled={enviando} onClick={guardarPlanteles}>{detalle.estatus === 'BAJA' ? 'Reactivar con estos planteles' : 'Guardar planteles'}</button><button onClick={() => setDetalle(null)}>Cerrar</button>
        {detalle.clases.map((c) => <p key={c.id}>{c.ciclo} · {c.plantel} · {c.grupo} · {c.materia} · {c.vigente ? 'Vigente' : 'Histórico'}</p>)}
        <a href="/grupos">Reasignar clases desde Grupos</a>
      </section>}
      <table className="tabla">
        <thead>
          <tr><th>Empleado</th><th>Nombre</th><th>Planteles</th><th>Especialidad</th><th>Correo</th><th>Estatus</th><th /></tr>
        </thead>
        <tbody>
          {resultado.datos.map((d) => (
            <tr key={d.id}>
              <td>{d.numEmpleado}</td>
              <td>{d.usuario.nombre} {d.usuario.apellidoPaterno}</td>
              <td>{d.planteles.join(', ') || '—'}</td>
              <td>{d.especialidad ?? '—'}</td>
              <td>{d.usuario.email}</td>
              <td><span className={`sello ${d.estatus === 'ACTIVO' ? 'ok' : 'neutro'}`}>{d.estatus}</span></td>
              <td className="derecha"><button disabled={enviando} className="boton secundario chico" onClick={() => editar(d)}>Editar</button> <button onClick={() => verClases(d)}>Planteles y clases</button> {d.estatus === 'ACTIVO' && <button disabled={enviando} className="boton peligro chico" onClick={() => baja(d)}>Dar de baja</button>}</td>
            </tr>
          ))}
          {resultado.datos.length === 0 && <tr><td className="vacio" colSpan={7}>Sin docentes registrados.</td></tr>}
        </tbody>
      </table>
      <Paginador total={resultado.total} pagina={resultado.pagina} porPagina={resultado.porPagina} onCambio={(pagina) => cargar(pagina, filtroPlantel)} />
    </>
  );
}
