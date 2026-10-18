import { MateriasGrupo } from '../features/grupos/MateriasGrupo';
import { InscripcionesGrupo } from '../features/grupos/InscripcionesGrupo';
import type { Ciclo, Plantel, Grupo, ResultadoGrupos, Materia, GrupoMateria, Inscripcion } from '../features/grupos/tipos';
import { useConfirmacion } from '../components/useConfirmacion';
import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { api, mensajeDeError } from '../api/client';

import { Encabezado } from '../components/Encabezado';
import { Paginador } from '../components/Paginador';
import '../components/tabla-adaptable.css';











export default function GruposPage() {
  const confirmacion = useConfirmacion();
  const [ciclos, setCiclos] = useState<Ciclo[]>([]);
  const [planteles, setPlanteles] = useState<Plantel[]>([]);
  const [filtroCiclo, setFiltroCiclo] = useState('');
  const [filtroPlantel, setFiltroPlantel] = useState('');
  const [plantelAplicado, setPlantelAplicado] = useState('');
  const [resultado, setResultado] = useState<ResultadoGrupos>({ datos: [], total: 0, pagina: 1, porPagina: 10 });
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
  const [cargandoListado, setCargandoListado] = useState(false);
  const consultaListado = useRef(0);
  const consultaGrupo = useRef(0);
  const consultaCatalogos = useRef(0);
  const [errorCatalogos, setErrorCatalogos] = useState('');
  const [cargandoCatalogos, setCargandoCatalogos] = useState(true);
  const [cargandoGrupo, setCargandoGrupo] = useState(false);
  const [detalleGrupoCompleto, setDetalleGrupoCompleto] = useState(false);
  const [editando, setEditando] = useState<Grupo | null>(null);
  const [reasignando, setReasignando] = useState<number | null>(null);
  const [nuevoDocente, setNuevoDocente] = useState('');
  const operar = async (ruta: string, metodo: 'delete' | 'patch', datos?: object) => {
    if (enviando || !await confirmacion.solicitar('¿Confirmar esta corrección? El historial académico se conserva.')) return;
    setEnviando(true); setError('');
    try { await api.request({ url: ruta, method: metodo, data: datos }); setMensaje('Corrección completada');
      await cargar(1, plantelAplicado); if (seleccionado) await abrirGrupo(seleccionado);
    } catch (err) { setError(mensajeDeError(err)); } finally { setEnviando(false); }
  };
  const editar = (g: Grupo) => {
    setEditando(g); setFormGrupo({ cicloId: String(g.ciclo.id), plantelId: String(g.plantel?.id ?? ''),
      nombre: g.nombre, grado: g.grado ?? '', turno: g.turno ?? 'MATUTINO' });
    document.getElementById('form-grupo')?.scrollIntoView();
  };

  const cargar = useCallback(async (pagina = 1, plantelId = '') => {
    const actual = ++consultaListado.current;
    setCargandoListado(true);
    setError('');
    try {
      const { data } = await api.get<ResultadoGrupos>('/academico/grupos', {
        params: { pagina, ...(filtroCiclo ? { cicloId: filtroCiclo, inactivos: true } : {}), ...(plantelId ? { plantelId } : {}) },
      });
      if (actual === consultaListado.current) setResultado(data);
    } catch (err) {
      if (actual === consultaListado.current) setError(mensajeDeError(err));
    } finally {
      if (actual === consultaListado.current) setCargandoListado(false);
    }
  }, [filtroCiclo]);
  const cargarCatalogos = useCallback(async () => {
    const actual = ++consultaCatalogos.current;
    setCargandoCatalogos(true); setErrorCatalogos('');
    try {
      const [ciclosR, plantelesR, materiasR] = await Promise.all([
      api.get<Ciclo[]>('/academico/ciclos'),
      api.get<Plantel[]>('/planteles/mios'),
      api.get<Materia[]>('/academico/materias'),
      ]);
      if (actual !== consultaCatalogos.current) return;
      setCiclos(ciclosR.data);
      setPlanteles(plantelesR.data);
      setMaterias(materiasR.data);
    } catch (err) {
      if (actual === consultaCatalogos.current) setErrorCatalogos(mensajeDeError(err));
    } finally {
      if (actual === consultaCatalogos.current) setCargandoCatalogos(false);
    }
  }, []);
  useEffect(() => {
    void cargarCatalogos();
    return () => { consultaCatalogos.current += 1; consultaGrupo.current += 1; };
  }, [cargarCatalogos]);
  useEffect(() => {
    void cargar(1, plantelAplicado);
    return () => { consultaListado.current += 1; };
  }, [cargar, plantelAplicado]);

  const abrirGrupo = async (grupo: Grupo) => {
    const actual = ++consultaGrupo.current;
    setSeleccionado(grupo);
    setAsignaciones([]);
    setInscritos([]);
    setReasignando(null); setNuevoDocente('');
    setMateriaId(''); setDocenteId(''); setAlumnoId('');
    setCargandoGrupo(true);
    setDetalleGrupoCompleto(false);
    setError('');
    try {
      const [gms, insc] = await Promise.all([
        api.get<GrupoMateria[]>(`/academico/grupos/${grupo.id}/materias`),
        api.get<Inscripcion[]>(`/academico/grupos/${grupo.id}/alumnos`),
      ]);
      if (actual === consultaGrupo.current) {
        setAsignaciones(gms.data);
        setInscritos(insc.data);
        setDetalleGrupoCompleto(true);
      }
    } catch (err) {
      if (actual === consultaGrupo.current) setError(mensajeDeError(err));
    } finally {
      if (actual === consultaGrupo.current) setCargandoGrupo(false);
    }
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
      setEditando(null); setMensaje(editando ? 'Grupo actualizado.' : 'Grupo creado. Ahora selecciona Administrar para asignar materias, docente e inscribir alumnos.');
      setFormGrupo({ cicloId: '', plantelId: '', nombre: '', grado: '', turno: 'MATUTINO' });
      cargar(1, plantelAplicado);
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
      await abrirGrupo(seleccionado);
      setMensaje('Materia vinculada. Revisa que tenga docente asignado antes de la captura.');
    } catch (err) { setError(mensajeDeError(err)); } finally { setEnviando(false); }
  };

  const inscribir = async (e: FormEvent) => {
    e.preventDefault();
    if (!seleccionado) return;
    if (enviando) return; setEnviando(true); setError('');
    try {
      await api.post(`/academico/grupos/${seleccionado.id}/alumnos`, { alumnoId: Number(alumnoId) });
      setAlumnoId('');
      await abrirGrupo(seleccionado);
      setMensaje('Inscripción registrada. El alumno podrá consultar las materias y actividades vigentes que le correspondan.');
    } catch (err) { setError(mensajeDeError(err)); } finally { setEnviando(false); }
  };

  return (
    <>{confirmacion.elemento}
      <Encabezado titulo="Grupos" detalle="Grupos por ciclo, materias asignadas e inscripciones" />
      <p className="texto-ayuda">Orden recomendado: prepara el ciclo y las materias, registra docentes y alumnos, crea el grupo, asígnale materias con docente e inscribe a los alumnos. Cada paso es independiente y conserva las reglas de autorización del servidor.</p>
      {error && <p role="alert" className="mensaje-error">{error}</p>}{mensaje && <p role="status" className="mensaje-ok">{mensaje}</p>}
      {cargandoCatalogos && <p role="status">Cargando catálogos…</p>}
      {errorCatalogos && <div role="alert"><p>{errorCatalogos}</p><button className="boton secundario" onClick={() => { void cargarCatalogos(); }}>Reintentar catálogos</button></div>}

      <section className="panel">
        <p className="texto-ayuda">Paso 1: selecciona un plantel y un ciclo en preparación o activo. Después abre Administrar para asignar materias y docentes e inscribir alumnos.</p><h2 id="form-grupo">{editando ? 'Editar grupo' : 'Nuevo grupo'}</h2>
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
        <button className="boton secundario" disabled={cargandoListado} onClick={() => {
          if (filtroPlantel === plantelAplicado) void cargar(1, plantelAplicado);
          else setPlantelAplicado(filtroPlantel);
        }}>Aplicar</button>
      </div>

      <div className="cabecera-listado"><h2>Directorio de grupos</h2><p>{resultado.total} grupos</p></div>
      {cargandoListado && <p role="status">Cargando grupos…</p>}
      <div className="tabla-contenedor" role="region" aria-label="Listado de grupos" tabIndex={0}>
      <table className="tabla tabla-adaptable" aria-busy={cargandoListado}>
        <caption className="solo-lector">ID de importación, grupo, plantel, ciclo, grado, turno y acciones</caption>
        <thead><tr><th scope="col">ID</th><th scope="col">Grupo</th><th scope="col">Plantel</th><th scope="col">Ciclo</th><th scope="col">Grado</th><th scope="col">Turno</th><th scope="col">Acciones</th></tr></thead>
        <tbody>
          {resultado.datos.map((g) => (
            <tr key={g.id}>
              <td data-etiqueta="ID"><code>{g.id}</code></td>
              <td data-etiqueta="Grupo">{g.nombre}</td>
              <td data-etiqueta="Plantel">{g.plantel?.nombre ?? <span className="sello neutro">Sin plantel</span>}</td>
              <td data-etiqueta="Ciclo">{g.ciclo?.clave}</td>
              <td data-etiqueta="Grado">{g.grado ?? '—'}</td>
              <td data-etiqueta="Turno">{g.turno ?? '—'}</td>
              <td data-etiqueta="Acciones" className="derecha">
                <span className="acciones-fila">
                  <button className="boton secundario chico" disabled={enviando} onClick={() => abrirGrupo(g)}>Administrar</button>
                  <button className="boton secundario chico" disabled={enviando} onClick={() => editar(g)}>Editar</button>
                  <button className="boton peligro chico" disabled={enviando} onClick={() => operar(`/academico/grupos/${g.id}`, 'delete')}>Desactivar grupo</button>
                </span>
              </td>
            </tr>
          ))}
          {!cargandoListado && resultado.datos.length === 0 && <tr><td className="vacio" colSpan={7}>No hay grupos para este ciclo y plantel.</td></tr>}
          {cargandoListado && resultado.datos.length === 0 && <tr><td className="vacio" colSpan={7}>Consultando grupos…</td></tr>}
        </tbody>
      </table></div>
      <Paginador total={resultado.total} pagina={resultado.pagina} porPagina={resultado.porPagina} deshabilitado={cargandoListado} onCambio={(pagina) => cargar(pagina, plantelAplicado)} />

      {cargandoGrupo && <p role="status">Cargando detalle del grupo…</p>}
      {seleccionado && !cargandoGrupo && !detalleGrupoCompleto && <button className="boton secundario" onClick={() => { void abrirGrupo(seleccionado); }}>Reintentar detalle del grupo</button>}
      {seleccionado && !cargandoGrupo && detalleGrupoCompleto && (
        <>
          <section className="panel" aria-label="Preparación del grupo"><h2>{seleccionado.nombre}: siguientes pasos</h2><ol><li>Grupo registrado en {seleccionado.ciclo.clave}.</li><li>{asignaciones.length} materias asignadas; {asignaciones.filter((a) => !a.docente).length} pendientes de docente.</li><li>{inscritos.length} alumnos inscritos. El expediente se registra por separado.</li></ol></section>
          <MateriasGrupo seleccionado={seleccionado} reasignando={reasignando} nuevoDocente={nuevoDocente} setNuevoDocente={setNuevoDocente} enviando={enviando} operar={operar} setReasignando={setReasignando} asignarMateria={asignarMateria} materiaId={materiaId} setMateriaId={setMateriaId} materias={materias} docenteId={docenteId} setDocenteId={setDocenteId} asignaciones={asignaciones} />

          <InscripcionesGrupo seleccionado={seleccionado} inscribir={inscribir} alumnoId={alumnoId} setAlumnoId={setAlumnoId} enviando={enviando} inscritos={inscritos} operar={operar} />
        </>
      )}
    </>
  );
}
