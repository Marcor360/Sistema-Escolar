import { useModuloTrabajo } from '../components/ModuloTrabajo';
import { ContextoAcademicoSelector, CONTEXTO_VACIO } from '../components/ContextoAcademicoSelector';
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
  const [filtroCiclo, setFiltroCiclo] = useState(new URLSearchParams(location.search).get('ciclo') || '');
  const [filtroPlantel, setFiltroPlantel] = useState(new URLSearchParams(location.search).get('plantel') || '');
  const [plantelAplicado, setPlantelAplicado] = useState(new URLSearchParams(location.search).get('plantel') || '');
  const [resultado, setResultado] = useState<ResultadoGrupos>({ datos: [], total: 0, pagina: 1, porPagina: 10 });
  const [materias, setMaterias] = useState<Materia[]>([]);
  const [seleccionado, setSeleccionado] = useState<Grupo | null>(null);
  const [asignaciones, setAsignaciones] = useState<GrupoMateria[]>([]);
  const [inscritos, setInscritos] = useState<Inscripcion[]>([]);
  const [contexto, setContexto] = useState(CONTEXTO_VACIO);
  const [usarContexto, setUsarContexto] = useState(false);
  const [filtroContexto, setFiltroContexto] = useState(CONTEXTO_VACIO);
  const [formGrupo, setFormGrupo] = useState({ cicloId: '', plantelId: '', nombre: '', grado: '', turno: 'MATUTINO' });
  const [materiaId, setMateriaId] = useState('');
  const [docenteId, setDocenteId] = useState('');
  const [alumnoId, setAlumnoId] = useState('');
  const [motivoReactivar,setMotivoReactivar]=useState(''),[documentoReactivar,setDocumentoReactivar]=useState('');
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [enviando, setEnviando] = useState(false);
  const trabajo = useModuloTrabajo(enviando), legado = trabajo.modo === 'legado', consultaVisible = legado || trabajo.modo === 'consulta';
  const paginaQuery = Math.max(1, Number(trabajo.query.get('pagina')) || 1), buscarQuery = trabajo.query.get('buscar') || '';
  const [buscar,setBuscar] = useState(buscarQuery);
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
    setContexto({ nivelId: g.nivelId ? String(g.nivelId) : '', carreraId: g.carreraId ? String(g.carreraId) : '', periodoAcademicoId: g.periodoAcademicoId ? String(g.periodoAcademicoId) : '' }); setUsarContexto(Boolean(g.nivelId));
    setEditando(g); setFormGrupo({ cicloId: String(g.ciclo.id), plantelId: String(g.plantel?.id ?? ''),
      nombre: g.nombre, grado: g.grado ?? '', turno: g.turno ?? 'MATUTINO' });
    if(!legado) trabajo.ir('editar',g.id);
    document.getElementById('form-grupo')?.scrollIntoView();
  };

  const consultar = useCallback(async (pagina = 1, plantelId = '') => {
    const actual = ++consultaListado.current;
    setCargandoListado(true);
    setError('');
    try {
      const { data } = await api.get<ResultadoGrupos>('/academico/grupos', {
        params: { pagina, ...(legado ? {} : {porPagina:10}), ...(buscarQuery ? {buscar:buscarQuery} : {}), ...(filtroContexto.nivelId ? { nivelId: filtroContexto.nivelId } : {}), ...(filtroContexto.carreraId ? { carreraId: filtroContexto.carreraId } : {}), ...(filtroContexto.periodoAcademicoId ? { periodoAcademicoId: filtroContexto.periodoAcademicoId } : {}), ...(filtroCiclo ? { cicloId: filtroCiclo, inactivos: true } : {}), ...(plantelId ? { plantelId } : {}) },
      });
      if (actual === consultaListado.current) setResultado(data);
    } catch (err) {
      if (actual === consultaListado.current) setError(mensajeDeError(err));
    } finally {
      if (actual === consultaListado.current) setCargandoListado(false);
    }
  }, [filtroCiclo, filtroContexto, buscarQuery, legado]);
  const cargar = (pagina = 1, plantelId = '') => legado ? consultar(pagina,plantelId) : Promise.resolve(trabajo.actualizar({pagina:String(pagina),plantel:plantelId,ciclo:filtroCiclo,nivel:filtroContexto.nivelId,carrera:filtroContexto.carreraId,periodo:filtroContexto.periodoAcademicoId,buscar}));
  const plantelQuery = trabajo.query.get('plantel') || '', cicloQuery = trabajo.query.get('ciclo') || '', nivelQuery = trabajo.query.get('nivel') || '', carreraQuery = trabajo.query.get('carrera') || '', periodoQuery = trabajo.query.get('periodo') || '';
  useEffect(()=>{
    if(legado) return;
    setFiltroPlantel(plantelQuery);setPlantelAplicado(plantelQuery);setFiltroCiclo(cicloQuery);setBuscar(buscarQuery);
    setFiltroContexto(prev=>prev.nivelId===nivelQuery && prev.carreraId===carreraQuery && prev.periodoAcademicoId===periodoQuery ? prev : {nivelId:nivelQuery,carreraId:carreraQuery,periodoAcademicoId:periodoQuery});
  },[legado,plantelQuery,cicloQuery,nivelQuery,carreraQuery,periodoQuery,buscarQuery]);
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
    if(consultaVisible) void consultar(paginaQuery, plantelAplicado);
    return () => { consultaListado.current += 1; };
  }, [consultar, plantelAplicado,consultaVisible,paginaQuery]);

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

  useEffect(() => {
    if(legado) return;
    if(trabajo.modo === 'nuevo') {setEditando(null);setFormGrupo({cicloId:'',plantelId:'',nombre:'',grado:'',turno:'MATUTINO'});setContexto(CONTEXTO_VACIO);setUsarContexto(false);}
    if(!trabajo.id || !['editar','administrar'].includes(trabajo.modo))return;
    let vigente = true;
    api.get<Grupo>(`/academico/grupos/${trabajo.id}`).then(({data:g})=>{if(!vigente)return;if(trabajo.modo==='editar') editar(g);else void abrirGrupo(g);}).catch(e=>{if(vigente)setError(mensajeDeError(e));});
    return()=>{vigente=false;};
    // Los handlers cargan solo el registro seleccionado; sus respuestas tienen contador propio.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trabajo.modo,trabajo.id,legado]);
  const crearGrupo = async (e: FormEvent) => {
    e.preventDefault();
    if (enviando) return; setEnviando(true); setError('');
    try {
      const academico = { nivelId: usarContexto ? Number(contexto.nivelId) : null, carreraId: usarContexto ? Number(contexto.carreraId) : null, periodoAcademicoId: usarContexto ? Number(contexto.periodoAcademicoId) : null };
      const cambioContexto = !editando || Object.entries(academico).some(([k, v]) => (editando[k as keyof typeof academico] ?? null) !== v);
      if (editando) await api.patch(`/academico/grupos/${editando.id}`, { nombre: formGrupo.nombre, grado: formGrupo.grado || undefined, turno: formGrupo.turno, ...(cambioContexto ? academico : {}) });
      else await api.post('/academico/grupos', {
        ...(usarContexto ? academico : {}),
        cicloId: Number(formGrupo.cicloId),
        plantelId: Number(formGrupo.plantelId),
        nombre: formGrupo.nombre,
        grado: formGrupo.grado || undefined,
        turno: formGrupo.turno,
      });
      trabajo.guardado(); if(!legado) trabajo.ir('consulta');
      setContexto(CONTEXTO_VACIO); setUsarContexto(false);
      setEditando(null); setMensaje(editando ? 'Grupo actualizado.' : 'Grupo creado. Ahora selecciona Administrar para asignar materias y docentes. Las nuevas aperturas se realizan en Apertura de cartera.');
      setFormGrupo({ cicloId: '', plantelId: '', nombre: '', grado: '', turno: 'MATUTINO' });
      if(legado) void cargar(1, plantelAplicado);
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
      if (!await confirmacion.solicitar('Reactivar solo recupera una inscripción previa en baja de este mismo grupo, sin borrar notas ni generar cargos. ¿Confirmas la reactivación documentada?')) return;
      await api.post(`/academico/grupos/${seleccionado.id}/alumnos`, { alumnoId: Number(alumnoId),motivo:motivoReactivar,documentoRef:documentoReactivar });
      setAlumnoId('');
      await abrirGrupo(seleccionado);
      setMensaje('Inscripción académica confirmada sin generar cargos. Revisa el expediente y su apertura de cartera.');
    } catch (err) { setError(mensajeDeError(err)); } finally { setEnviando(false); }
  };

  return (
    <>{confirmacion.elemento}
      <Encabezado titulo="Grupos" detalle="Grupos por ciclo, materias asignadas e inscripciones" />
      <p className="texto-ayuda">Orden recomendado: prepara el ciclo y las materias, registra docentes y alumnos. Para una inscripción ordinaria con cargos usa Apertura de cartera; Grupos permite consultar clases y corregir inscripciones existentes según la política institucional, sin generar cargos.</p>
      {error && <p role="alert" className="mensaje-error">{error}</p>}{mensaje && <p role="status" className="mensaje-ok">{mensaje}</p>}
      {cargandoCatalogos && <p role="status">Cargando catálogos…</p>}
      {errorCatalogos && <div role="alert"><p>{errorCatalogos}</p><button className="boton secundario" onClick={() => { void cargarCatalogos(); }}>Reintentar catálogos</button></div>}

      {(legado || trabajo.modo === 'nuevo' || (trabajo.modo === 'editar' && editando?.id === trabajo.id)) && <section className="panel">
        <p className="texto-ayuda">Paso 1: selecciona un plantel y un ciclo en preparación o activo. Después abre Administrar para asignar materias y docentes e inscribir alumnos.</p><h2 id="form-grupo">{editando ? 'Editar grupo' : 'Nuevo grupo'}</h2>
        <form onSubmit={crearGrupo} className="fila">
          <div className="campo"><label htmlFor="grupos-campo-1">Plantel</label>
            <select id="grupos-campo-1" required disabled={editando !== null || enviando} value={formGrupo.plantelId} onChange={(e) => { setContexto(CONTEXTO_VACIO); setFormGrupo({ ...formGrupo, plantelId: e.target.value }); }}>
              <option value="">Selecciona…</option>
              {planteles.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
          </div>
          <div className="campo"><label htmlFor="grupos-campo-2">Ciclo</label>
            <select id="grupos-campo-2" required disabled={editando !== null || enviando} value={formGrupo.cicloId} onChange={(e) => { setContexto(CONTEXTO_VACIO); setFormGrupo({ ...formGrupo, cicloId: e.target.value }); }}>
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
          <label className="casilla"><input type="checkbox" checked={usarContexto} onChange={(e) => { setUsarContexto(e.target.checked); if (!e.target.checked) setContexto(CONTEXTO_VACIO); }} />Asignar nivel, carrera/plan y periodo</label>
          {usarContexto && <ContextoAcademicoSelector plantelId={formGrupo.plantelId} cicloId={formGrupo.cicloId} valor={contexto} cambiar={setContexto} deshabilitado={enviando} />}
          <button disabled={enviando} className="boton">{editando ? 'Guardar corrección' : 'Crear grupo'}</button>{editando && <button type="button" onClick={() => {if(!legado) trabajo.ir('consulta'); else {setContexto(CONTEXTO_VACIO); setUsarContexto(false); setEditando(null); setFormGrupo({ cicloId: '', plantelId: '', nombre: '', grado: '', turno: 'MATUTINO' });}}}>Cancelar edición</button>}
        </form>
      </section>}

      {consultaVisible && <><div className="fila" style={{ marginBottom: 12 }}><div className="campo"><label htmlFor="filtro-ciclo-grupos">Consultar ciclo</label><select id="filtro-ciclo-grupos" value={filtroCiclo} onChange={(e) => { setFiltroContexto(CONTEXTO_VACIO); setFiltroCiclo(e.target.value); }}><option value="">Vigente</option>{ciclos.map((c) => <option key={c.id} value={c.id}>{c.clave} · {c.estado}</option>)}</select></div>
        <div className="campo"><label htmlFor="grupos-campo-6">Filtrar por plantel</label>
          <select id="grupos-campo-6" value={filtroPlantel} onChange={(e) => { setFiltroContexto(CONTEXTO_VACIO); setFiltroPlantel(e.target.value); }}>
            <option value="">Todos</option>
            {planteles.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
        </div>
        <button className="boton secundario" disabled={cargandoListado} onClick={() => {
          if(!legado) { void cargar(1,filtroPlantel); setPlantelAplicado(filtroPlantel); return; }
          if (filtroPlantel === plantelAplicado) void cargar(1, plantelAplicado);
          else setPlantelAplicado(filtroPlantel);
        }}>Aplicar</button>
      </div>

      {filtroPlantel && filtroCiclo && <ContextoAcademicoSelector plantelId={filtroPlantel} cicloId={filtroCiclo} valor={filtroContexto} cambiar={setFiltroContexto} />}
      {!legado && <form className="fila" onSubmit={e=>{e.preventDefault();void cargar(1,plantelAplicado);}}><label>Buscar por nombre<input value={buscar} onChange={e=>setBuscar(e.target.value)} /></label><button>Buscar</button></form>}
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
              <td data-etiqueta="Grupo">{g.nombre}{g.nombre.startsWith('AUTO-') && <span className="sello neutro">Generado automáticamente</span>}</td>
              <td data-etiqueta="Plantel">{g.plantel?.nombre ?? <span className="sello neutro">Sin plantel</span>}</td>
              <td data-etiqueta="Ciclo">{g.ciclo?.clave}</td>
              <td data-etiqueta="Grado">{g.grado ?? '—'}</td>
              <td data-etiqueta="Turno">{g.turno ?? '—'}</td>
              <td data-etiqueta="Acciones" className="derecha">
                <span className="acciones-fila">
                  <button className="boton secundario chico" disabled={enviando} onClick={() => {if(legado) void abrirGrupo(g); else trabajo.ir('administrar',g.id);}}>Administrar</button>
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
      </>}

      {cargandoGrupo && <p role="status">Cargando detalle del grupo…</p>}
      {(legado || trabajo.modo === 'administrar') && seleccionado && !cargandoGrupo && !detalleGrupoCompleto && <button className="boton secundario" onClick={() => { void abrirGrupo(seleccionado); }}>Reintentar detalle del grupo</button>}
      {seleccionado && !cargandoGrupo && detalleGrupoCompleto && (
        <>
          <section className="panel" aria-label="Preparación del grupo">
            <h2>{seleccionado.nombre}: preparación académica</h2>
            {seleccionado.nombre.startsWith('AUTO-') && <p className="texto-ayuda">Este grupo fue generado automáticamente. Su clave es provisional: Control Escolar debe revisar la denominación institucional antes del inicio de clases.</p>}
            <ol>
              <li>Grupo registrado en el ciclo {seleccionado.ciclo.clave}.</li>
              <li>{asignaciones.length} materias asignadas; {asignaciones.filter((a) => !a.docente).length} pendientes de docente.</li>
              <li>{inscritos.length} alumnos inscritos; el expediente y la cartera se verifican en módulos separados.</li>
            </ol>
            {asignaciones.length === 0 ? <p role="status">Preparación pendiente: registra las materias y sus docentes desde este panel.</p>
              : asignaciones.some((a) => !a.docente) ? <p role="status">Preparación pendiente: asigna los profesores que faltan antes de impartir clases.</p>
              : inscritos.length === 0 ? <p role="status">Materias y profesores asignados; todavía no hay alumnos inscritos.</p>
              : <p role="status">Asignaciones académicas completas en este grupo. Verifica por separado ciclo vigente, cartera y documentación institucional.</p>}
          </section>
          <MateriasGrupo seleccionado={seleccionado} reasignando={reasignando} nuevoDocente={nuevoDocente} setNuevoDocente={setNuevoDocente} enviando={enviando} operar={operar} setReasignando={setReasignando} asignarMateria={asignarMateria} materiaId={materiaId} setMateriaId={setMateriaId} materias={materias} docenteId={docenteId} setDocenteId={setDocenteId} asignaciones={asignaciones} />

          <InscripcionesGrupo seleccionado={seleccionado} motivo={motivoReactivar} setMotivo={setMotivoReactivar} documento={documentoReactivar} setDocumento={setDocumentoReactivar} inscribir={inscribir} alumnoId={alumnoId} setAlumnoId={setAlumnoId} enviando={enviando} inscritos={inscritos} operar={operar} />
        </>
      )}
    </>
  );
}
