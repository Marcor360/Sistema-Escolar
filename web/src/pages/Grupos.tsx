import { FormEvent, useEffect, useState } from 'react';
import { api, mensajeDeError } from '../api/client';
import { Encabezado } from '../components/Encabezado';

interface Ciclo { id: number; clave: string; activo: boolean }
interface Plantel { id: number; nombre: string }
interface Grupo { id: number; nombre: string; grado?: string; turno?: string; ciclo: Ciclo; plantel: Plantel | null }
interface Materia { id: number; clave: string; nombre: string }
interface Docente { id: number; numEmpleado: string; usuario: { nombre: string; apellidoPaterno: string } }
interface GrupoMateria { id: number; materia: Materia; docente: Docente | null }
interface Inscripcion { id: number; alumno: { id: number; matricula: string; usuario: { nombre: string; apellidoPaterno: string } } }
interface Alumno { id: number; matricula: string; usuario: { nombre: string; apellidoPaterno: string } }

export default function GruposPage() {
  const [ciclos, setCiclos] = useState<Ciclo[]>([]);
  const [planteles, setPlanteles] = useState<Plantel[]>([]);
  const [filtroPlantel, setFiltroPlantel] = useState('');
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [materias, setMaterias] = useState<Materia[]>([]);
  const [docentes, setDocentes] = useState<Docente[]>([]);
  const [alumnos, setAlumnos] = useState<Alumno[]>([]);
  const [seleccionado, setSeleccionado] = useState<Grupo | null>(null);
  const [asignaciones, setAsignaciones] = useState<GrupoMateria[]>([]);
  const [inscritos, setInscritos] = useState<Inscripcion[]>([]);
  const [formGrupo, setFormGrupo] = useState({ cicloId: '', plantelId: '', nombre: '', grado: '', turno: 'MATUTINO' });
  const [materiaId, setMateriaId] = useState('');
  const [docenteId, setDocenteId] = useState('');
  const [alumnoId, setAlumnoId] = useState('');
  const [error, setError] = useState('');

  const cargar = (plantelId = filtroPlantel) => {
    api.get<Ciclo[]>('/academico/ciclos').then((r) => setCiclos(r.data));
    api.get<Grupo[]>('/academico/grupos', { params: plantelId ? { plantelId } : {} }).then((r) => setGrupos(r.data));
    api.get<Plantel[]>('/planteles/mios').then((r) => setPlanteles(r.data));
    api.get<Materia[]>('/academico/materias').then((r) => setMaterias(r.data));
    api.get<Docente[]>('/docentes').then((r) => setDocentes(r.data));
    api.get<Alumno[]>('/alumnos').then((r) => setAlumnos(r.data));
  };
  useEffect(() => { cargar(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const abrirGrupo = async (grupo: Grupo) => {
    setSeleccionado(grupo);
    setError('');
    const [gms, insc] = await Promise.all([
      api.get<GrupoMateria[]>(`/academico/grupos/${grupo.id}/materias`),
      api.get<Inscripcion[]>(`/academico/grupos/${grupo.id}/alumnos`),
    ]);
    setAsignaciones(gms.data);
    setInscritos(insc.data);
  };

  const crearGrupo = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await api.post('/academico/grupos', {
        cicloId: Number(formGrupo.cicloId),
        plantelId: Number(formGrupo.plantelId),
        nombre: formGrupo.nombre,
        grado: formGrupo.grado || undefined,
        turno: formGrupo.turno,
      });
      setFormGrupo({ cicloId: '', plantelId: '', nombre: '', grado: '', turno: 'MATUTINO' });
      cargar();
    } catch (err) { setError(mensajeDeError(err)); }
  };

  const asignarMateria = async (e: FormEvent) => {
    e.preventDefault();
    if (!seleccionado) return;
    setError('');
    try {
      await api.post(`/academico/grupos/${seleccionado.id}/materias`, {
        materiaId: Number(materiaId),
        docenteId: docenteId ? Number(docenteId) : undefined,
      });
      setMateriaId(''); setDocenteId('');
      abrirGrupo(seleccionado);
    } catch (err) { setError(mensajeDeError(err)); }
  };

  const inscribir = async (e: FormEvent) => {
    e.preventDefault();
    if (!seleccionado) return;
    setError('');
    try {
      await api.post(`/academico/grupos/${seleccionado.id}/alumnos`, { alumnoId: Number(alumnoId) });
      setAlumnoId('');
      abrirGrupo(seleccionado);
    } catch (err) { setError(mensajeDeError(err)); }
  };

  return (
    <>
      <Encabezado titulo="Grupos" detalle="Grupos por ciclo, materias asignadas e inscripciones" />
      {error && <p className="mensaje-error">{error}</p>}

      <section className="panel">
        <h2>Nuevo grupo</h2>
        <form onSubmit={crearGrupo} className="fila">
          <div className="campo"><label>Plantel</label>
            <select required value={formGrupo.plantelId} onChange={(e) => setFormGrupo({ ...formGrupo, plantelId: e.target.value })}>
              <option value="">Selecciona…</option>
              {planteles.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
          </div>
          <div className="campo"><label>Ciclo</label>
            <select required value={formGrupo.cicloId} onChange={(e) => setFormGrupo({ ...formGrupo, cicloId: e.target.value })}>
              <option value="">Selecciona…</option>
              {ciclos.map((c) => <option key={c.id} value={c.id}>{c.clave}</option>)}
            </select>
          </div>
          <div className="campo"><label>Nombre</label>
            <input required placeholder="1-A" value={formGrupo.nombre} onChange={(e) => setFormGrupo({ ...formGrupo, nombre: e.target.value })} />
          </div>
          <div className="campo"><label>Grado</label>
            <input value={formGrupo.grado} onChange={(e) => setFormGrupo({ ...formGrupo, grado: e.target.value })} />
          </div>
          <div className="campo"><label>Turno</label>
            <select value={formGrupo.turno} onChange={(e) => setFormGrupo({ ...formGrupo, turno: e.target.value })}>
              <option value="MATUTINO">Matutino</option>
              <option value="VESPERTINO">Vespertino</option>
            </select>
          </div>
          <button className="boton">Crear grupo</button>
        </form>
      </section>

      <div className="fila" style={{ marginBottom: 12 }}>
        <div className="campo"><label>Filtrar por plantel</label>
          <select value={filtroPlantel} onChange={(e) => setFiltroPlantel(e.target.value)}>
            <option value="">Todos</option>
            {planteles.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
        </div>
        <button className="boton secundario" onClick={() => cargar()}>Aplicar</button>
      </div>

      <table className="tabla" style={{ marginBottom: 24 }}>
        <thead><tr><th>Grupo</th><th>Plantel</th><th>Ciclo</th><th>Grado</th><th>Turno</th><th /></tr></thead>
        <tbody>
          {grupos.map((g) => (
            <tr key={g.id}>
              <td>{g.nombre}</td><td>{g.plantel?.nombre ?? <span className="sello neutro">Sin plantel</span>}</td><td>{g.ciclo?.clave}</td><td>{g.grado ?? '—'}</td><td>{g.turno ?? '—'}</td>
              <td className="derecha">
                <button className="boton secundario chico" onClick={() => abrirGrupo(g)}>Administrar</button>
              </td>
            </tr>
          ))}
          {grupos.length === 0 && <tr><td className="vacio" colSpan={6}>Sin grupos. Crea el primero con el formulario.</td></tr>}
        </tbody>
      </table>

      {seleccionado && (
        <>
          <section className="panel">
            <h2>Materias del grupo {seleccionado.nombre}</h2>
            <form onSubmit={asignarMateria} className="fila" style={{ marginBottom: 14 }}>
              <div className="campo"><label>Materia</label>
                <select required value={materiaId} onChange={(e) => setMateriaId(e.target.value)}>
                  <option value="">Selecciona…</option>
                  {materias.map((m) => <option key={m.id} value={m.id}>{m.clave} — {m.nombre}</option>)}
                </select>
              </div>
              <div className="campo"><label>Docente</label>
                <select value={docenteId} onChange={(e) => setDocenteId(e.target.value)}>
                  <option value="">Sin asignar</option>
                  {docentes.map((d) => (
                    <option key={d.id} value={d.id}>{d.numEmpleado} — {d.usuario.nombre} {d.usuario.apellidoPaterno}</option>
                  ))}
                </select>
              </div>
              <button className="boton">Asignar materia</button>
            </form>
            <table className="tabla">
              <thead><tr><th>Materia</th><th>Docente</th></tr></thead>
              <tbody>
                {asignaciones.map((gm) => (
                  <tr key={gm.id}>
                    <td>{gm.materia.clave} — {gm.materia.nombre}</td>
                    <td>{gm.docente ? `${gm.docente.usuario.nombre} ${gm.docente.usuario.apellidoPaterno}` : <span className="sello aviso">Sin docente</span>}</td>
                  </tr>
                ))}
                {asignaciones.length === 0 && <tr><td className="vacio" colSpan={2}>Sin materias asignadas.</td></tr>}
              </tbody>
            </table>
          </section>

          <section className="panel">
            <h2>Alumnos inscritos en {seleccionado.nombre}</h2>
            <form onSubmit={inscribir} className="fila" style={{ marginBottom: 14 }}>
              <div className="campo"><label>Alumno</label>
                <select required value={alumnoId} onChange={(e) => setAlumnoId(e.target.value)}>
                  <option value="">Selecciona…</option>
                  {alumnos.map((a) => (
                    <option key={a.id} value={a.id}>{a.matricula} — {a.usuario.nombre} {a.usuario.apellidoPaterno}</option>
                  ))}
                </select>
              </div>
              <button className="boton">Inscribir</button>
            </form>
            <table className="tabla">
              <thead><tr><th>Matrícula</th><th>Alumno</th></tr></thead>
              <tbody>
                {inscritos.map((i) => (
                  <tr key={i.id}>
                    <td>{i.alumno.matricula}</td>
                    <td>{i.alumno.usuario.nombre} {i.alumno.usuario.apellidoPaterno}</td>
                  </tr>
                ))}
                {inscritos.length === 0 && <tr><td className="vacio" colSpan={2}>Sin alumnos inscritos.</td></tr>}
              </tbody>
            </table>
          </section>
        </>
      )}
    </>
  );
}
