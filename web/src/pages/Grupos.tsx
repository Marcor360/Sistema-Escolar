import { FormEvent, useCallback, useEffect, useState } from 'react';
import { api, mensajeDeError } from '../api/client';
import { SelectorBuscable } from '../components/SelectorBuscable';
import { Encabezado } from '../components/Encabezado';
import { Paginador } from '../components/Paginador';

interface Ciclo { id: number; clave: string; activo: boolean; estado: string }
interface Plantel { id: number; nombre: string }
interface Grupo { id: number; nombre: string; grado?: string; turno?: string; ciclo: Ciclo; plantel: Plantel | null }
interface ResultadoGrupos { datos: Grupo[]; total: number; pagina: number; porPagina: number }
interface Materia { id: number; clave: string; nombre: string }
interface Docente { id: number; numEmpleado: string; usuario: { nombre: string; apellidoPaterno: string } }
interface GrupoMateria { id: number; materia: Materia; docente: Docente | null }
interface Inscripcion { id: number; alumno: { id: number; matricula: string; usuario: { nombre: string; apellidoPaterno: string } } }
interface Alumno { id: number; matricula: string; usuario: { nombre: string; apellidoPaterno: string } }

export default function GruposPage() {
  const [ciclos, setCiclos] = useState<Ciclo[]>([]);
  const [planteles, setPlanteles] = useState<Plantel[]>([]);
  const [filtroCiclo, setFiltroCiclo] = useState('');
  const [filtroPlantel, setFiltroPlantel] = useState('');
  const [resultado, setResultado] = useState<ResultadoGrupos>({ datos: [], total: 0, pagina: 1, porPagina: 20 });
  const [materias, setMaterias] = useState<Materia[]>([]);
  const [seleccionado, setSeleccionado] = useState<Grupo | null>(null);
  const [asignaciones, setAsignaciones] = useState<GrupoMateria[]>([]);
  const [inscritos, setInscritos] = useState<Inscripcion[]>([]);
  const [formGrupo, setFormGrupo] = useState({ cicloId: '', plantelId: '', nombre: '', grado: '', turno: 'MATUTINO' });
  const [materiaId, setMateriaId] = useState('');
  const [docenteId, setDocenteId] = useState('');
  const [alumnoId, setAlumnoId] = useState('');
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [editando, setEditando] = useState<Grupo | null>(null);
  const [reasignando, setReasignando] = useState<number | null>(null);
  const [nuevoDocente, setNuevoDocente] = useState('');
  const operar = async (ruta: string, metodo: 'delete' | 'patch', datos?: object) => {
    if (enviando || !confirm('¿Confirmar esta corrección? El historial académico se conserva.')) return;
    setEnviando(true); setError('');
    try { await api.request({ url: ruta, method: metodo, data: datos }); setMensaje('Corrección completada');
      await cargar(1, filtroPlantel); if (seleccionado) await abrirGrupo(seleccionado);
    } catch (err) { setError(mensajeDeError(err)); } finally { setEnviando(false); }
  };
  const editar = (g: Grupo) => {
    setEditando(g); setFormGrupo({ cicloId: String(g.ciclo.id), plantelId: String(g.plantel?.id ?? ''),
      nombre: g.nombre, grado: g.grado ?? '', turno: g.turno ?? 'MATUTINO' });
    document.getElementById('form-grupo')?.scrollIntoView();
  };

  const cargar = useCallback(async (pagina = 1, plantelId = '') => {
    setError('');
    try {
      const [ciclosR, gruposR, plantelesR, materiasR] = await Promise.all([
        api.get<Ciclo[]>('/academico/ciclos'),
        api.get<ResultadoGrupos>('/academico/grupos', { params: { pagina, ...(filtroCiclo ? { cicloId: filtroCiclo, inactivos: true } : {}), ...(plantelId ? { plantelId } : {}) } }),
        api.get<Plantel[]>('/planteles/mios'),
        api.get<Materia[]>('/academico/materias'),
      ]);
      setCiclos(ciclosR.data);
      setResultado(gruposR.data);
      setPlanteles(plantelesR.data);
      setMaterias(materiasR.data);
    } catch (err) { setError(mensajeDeError(err)); }
  }, [filtroCiclo]);
  useEffect(() => { cargar(1, ''); }, [cargar]);

  const abrirGrupo = async (grupo: Grupo) => {
    setSeleccionado(grupo);
    setError('');
    try {
      const [gms, insc] = await Promise.all([
        api.get<GrupoMateria[]>(`/academico/grupos/${grupo.id}/materias`),
        api.get<Inscripcion[]>(`/academico/grupos/${grupo.id}/alumnos`),
      ]);
      setAsignaciones(gms.data);
      setInscritos(insc.data);
    } catch (err) { setError(mensajeDeError(err)); }
  };

  const crearGrupo = async (e: FormEvent) => {
    e.preventDefault();
    if (enviando) return; setEnviando(true); setError('');
    try {
      if (editando) await api.patch(`/academico/grupos/${editando.id}`, { nombre: formGrupo.nombre, grado: formGrupo.grado || undefined, turno: formGrupo.turno });
      else await api.post('/academico/grupos', {
        cicloId: Number(formGrupo.cicloId),
        plantelId: Number(formGrupo.plantelId),
        nombre: formGrupo.nombre,
        grado: formGrupo.grado || undefined,
        turno: formGrupo.turno,
      });
      setEditando(null); setMensaje('Grupo guardado');
      setFormGrupo({ cicloId: '', plantelId: '', nombre: '', grado: '', turno: 'MATUTINO' });
      cargar(1, filtroPlantel);
    } catch (err) { setError(mensajeDeError(err)); } finally { setEnviando(false); }
  };

  const asignarMateria = async (e: FormEvent) => {
    e.preventDefault();
    if (!seleccionado) return;
    if (enviando) return; setEnviando(true); setError('');
    try {
      await api.post(`/academico/grupos/${seleccionado.id}/materias`, {
        materiaId: Number(materiaId),
        docenteId: docenteId ? Number(docenteId) : undefined,
      });
      setMateriaId(''); setDocenteId('');
      abrirGrupo(seleccionado);
    } catch (err) { setError(mensajeDeError(err)); } finally { setEnviando(false); }
  };

  const inscribir = async (e: FormEvent) => {
    e.preventDefault();
    if (!seleccionado) return;
    if (enviando) return; setEnviando(true); setError('');
    try {
      await api.post(`/academico/grupos/${seleccionado.id}/alumnos`, { alumnoId: Number(alumnoId) });
      setAlumnoId('');
      abrirGrupo(seleccionado);
    } catch (err) { setError(mensajeDeError(err)); } finally { setEnviando(false); }
  };

  return (
    <>
      <Encabezado titulo="Grupos" detalle="Grupos por ciclo, materias asignadas e inscripciones" />
      {error && <p role="alert" className="mensaje-error">{error}</p>}{mensaje && <p role="status" className="mensaje-ok">{mensaje}</p>}

      <section className="panel">
        <h2 id="form-grupo">{editando ? 'Editar grupo' : 'Nuevo grupo'}</h2>
        <form onSubmit={crearGrupo} className="fila">
          <div className="campo"><label htmlFor="grupos-campo-1">Plantel</label>
            <select id="grupos-campo-1" required disabled={editando !== null || enviando} value={formGrupo.plantelId} onChange={(e) => setFormGrupo({ ...formGrupo, plantelId: e.target.value })}>
              <option value="">Selecciona…</option>
              {planteles.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
          </div>
          <div className="campo"><label htmlFor="grupos-campo-2">Ciclo</label>
            <select id="grupos-campo-2" required disabled={editando !== null || enviando} value={formGrupo.cicloId} onChange={(e) => setFormGrupo({ ...formGrupo, cicloId: e.target.value })}>
              <option value="">Selecciona…</option>
              {ciclos.filter((c) => (c.activo || c.estado === 'PREPARACION') || c.id === editando?.ciclo.id).map((c) => <option key={c.id} value={c.id}>{c.clave}</option>)}
            </select>
          </div>
          <div className="campo"><label htmlFor="grupos-campo-3">Nombre</label>
            <input id="grupos-campo-3" required placeholder="1-A" value={formGrupo.nombre} onChange={(e) => setFormGrupo({ ...formGrupo, nombre: e.target.value })} />
          </div>
          <div className="campo"><label htmlFor="grupos-campo-4">Grado</label>
            <input id="grupos-campo-4" value={formGrupo.grado} onChange={(e) => setFormGrupo({ ...formGrupo, grado: e.target.value })} />
          </div>
          <div className="campo"><label htmlFor="grupos-campo-5">Turno</label>
            <select id="grupos-campo-5" value={formGrupo.turno} onChange={(e) => setFormGrupo({ ...formGrupo, turno: e.target.value })}>
              <option value="MATUTINO">Matutino</option>
              <option value="VESPERTINO">Vespertino</option>
            </select>
          </div>
          <button disabled={enviando} className="boton">{editando ? 'Guardar corrección' : 'Crear grupo'}</button>{editando && <button type="button" onClick={() => { setEditando(null); setFormGrupo({ cicloId: '', plantelId: '', nombre: '', grado: '', turno: 'MATUTINO' }); }}>Cancelar edición</button>}
        </form>
      </section>

      <div className="fila" style={{ marginBottom: 12 }}><div className="campo"><label htmlFor="filtro-ciclo-grupos">Consultar ciclo</label><select id="filtro-ciclo-grupos" value={filtroCiclo} onChange={(e) => setFiltroCiclo(e.target.value)}><option value="">Vigente</option>{ciclos.map((c) => <option key={c.id} value={c.id}>{c.clave} · {c.estado}</option>)}</select></div>
        <div className="campo"><label htmlFor="grupos-campo-6">Filtrar por plantel</label>
          <select id="grupos-campo-6" value={filtroPlantel} onChange={(e) => setFiltroPlantel(e.target.value)}>
            <option value="">Todos</option>
            {planteles.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
        </div>
        <button className="boton secundario" onClick={() => cargar(1, filtroPlantel)}>Aplicar</button>
      </div>

      <table className="tabla" style={{ marginBottom: 24 }}>
        <thead><tr><th>Grupo</th><th>Plantel</th><th>Ciclo</th><th>Grado</th><th>Turno</th><th /></tr></thead>
        <tbody>
          {resultado.datos.map((g) => (
            <tr key={g.id}>
              <td>{g.nombre}</td><td>{g.plantel?.nombre ?? <span className="sello neutro">Sin plantel</span>}</td><td>{g.ciclo?.clave}</td><td>{g.grado ?? '—'}</td><td>{g.turno ?? '—'}</td>
              <td className="derecha">
                <button className="boton secundario chico" onClick={() => abrirGrupo(g)}>Administrar</button>
                <button disabled={enviando} onClick={() => editar(g)}>Editar</button>
                <button disabled={enviando} onClick={() => operar(`/academico/grupos/${g.id}`, 'delete')}>Desactivar grupo</button>
              </td>
            </tr>
          ))}
          {resultado.datos.length === 0 && <tr><td className="vacio" colSpan={6}>Sin grupos. Crea el primero con el formulario.</td></tr>}
        </tbody>
      </table>
      <Paginador total={resultado.total} pagina={resultado.pagina} porPagina={resultado.porPagina} onCambio={(pagina) => cargar(pagina, filtroPlantel)} />

      {seleccionado && (
        <>
          <section className="panel">
            <h2>Materias del grupo {seleccionado.nombre} · {seleccionado.ciclo.clave} · {seleccionado.plantel?.nombre}</h2>
            {reasignando && <div className="fila"><SelectorBuscable<Docente> ruta="/docentes" valor={nuevoDocente} cambiar={setNuevoDocente}
              etiqueta="Nuevo docente" filtros={{ plantelId: seleccionado.plantel?.id }} texto={(d) => `${d.numEmpleado} — ${d.usuario.nombre} ${d.usuario.apellidoPaterno}`} />
              <button disabled={enviando || !nuevoDocente} onClick={() => operar(`/academico/grupo-materias/${reasignando}/docente/${nuevoDocente}`, 'patch')}>Confirmar reasignación</button>
              <button onClick={() => setReasignando(null)}>Cancelar</button></div>}
            <form onSubmit={asignarMateria} className="fila" style={{ marginBottom: 14 }}>
              <div className="campo"><label htmlFor="grupos-campo-7">Materia</label>
                <select id="grupos-campo-7" required value={materiaId} onChange={(e) => setMateriaId(e.target.value)}>
                  <option value="">Selecciona…</option>
                  {materias.map((m) => <option key={m.id} value={m.id}>{m.clave} — {m.nombre}</option>)}
                </select>
              </div>
              <SelectorBuscable<Docente> ruta="/docentes" valor={docenteId} cambiar={setDocenteId} etiqueta="Docente" requerido={false}
                filtros={{ plantelId: seleccionado.plantel?.id }} texto={(d) => `${d.numEmpleado} — ${d.usuario.nombre} ${d.usuario.apellidoPaterno}`} />
              <button disabled={enviando} className="boton">Asignar materia</button>
            </form>
            <table className="tabla">
              <thead><tr><th>Materia</th><th>Docente</th><th>Correcciones</th></tr></thead>
              <tbody>
                {asignaciones.map((gm) => (
                  <tr key={gm.id}>
                    <td>{gm.materia.clave} — {gm.materia.nombre}</td>
                    <td>{gm.docente ? `${gm.docente.usuario.nombre} ${gm.docente.usuario.apellidoPaterno}` : <span className="sello aviso">Sin docente</span>}</td>
                    <td><button disabled={enviando} onClick={() => { setReasignando(gm.id); setNuevoDocente(''); }}>Reasignar docente</button>
                      <button disabled={enviando} onClick={() => operar(`/academico/grupo-materias/${gm.id}`, 'delete')}>Quitar materia</button></td>
                  </tr>
                ))}
                {asignaciones.length === 0 && <tr><td className="vacio" colSpan={2}>Sin materias asignadas.</td></tr>}
              </tbody>
            </table>
          </section>

          <section className="panel">
            <h2>Alumnos inscritos en {seleccionado.nombre}</h2>
            <form onSubmit={inscribir} className="fila" style={{ marginBottom: 14 }}>
              <SelectorBuscable<Alumno> ruta="/alumnos" valor={alumnoId} cambiar={setAlumnoId} etiqueta="Alumno"
                filtros={{ plantelId: seleccionado.plantel?.id }} texto={(a) => `${a.matricula} — ${a.usuario.nombre} ${a.usuario.apellidoPaterno}`} />
              <button disabled={enviando} className="boton">Inscribir</button>
            </form>
            <table className="tabla">
              <thead><tr><th>Matrícula</th><th>Alumno</th><th>Correcciones</th></tr></thead>
              <tbody>
                {inscritos.map((i) => (
                  <tr key={i.id}>
                    <td>{i.alumno.matricula}</td>
                    <td>{i.alumno.usuario.nombre} {i.alumno.usuario.apellidoPaterno}</td><td><button disabled={enviando} onClick={() => operar(`/academico/inscripciones/${i.id}`, 'delete')}>Dar de baja inscripción</button></td>
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
