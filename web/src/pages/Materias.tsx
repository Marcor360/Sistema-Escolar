import { useSearchParams } from 'react-router-dom';
import { Paginador } from '../components/Paginador';
import '../components/tabla-adaptable.css';
import { useDialogoMotivo } from '../components/useDialogoMotivo';
import { useConfirmacion } from '../components/useConfirmacion';
import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { api, mensajeDeError } from '../api/client';
import { Encabezado } from '../components/Encabezado';
import { useAuth } from '../auth/AuthContext';
interface Materia { id: number; clave: string; nombre: string; creditos: number; descripcion?: string }
interface Ciclo { id: number; clave: string; nombre: string; activo: boolean; estado: string; fechaInicio: string; fechaFin: string }
interface ResumenCierre { grupos: number; clases: number; inscritos: number; puedeCerrar: boolean; faltantes: { grupoId?: number; grupoMateriaId: number; parcial: number; sinNota: number; cerrado: boolean }[] }
const MATERIA = { clave: '', nombre: '', creditos: '0', descripcion: '' };
const CICLO = { clave: '', nombre: '', fechaInicio: '', fechaFin: '' };
export default function MateriasPage() {
  const confirmacion = useConfirmacion(); const dialogo = useDialogoMotivo();
  const [materias, setMaterias] = useState<Materia[]>([]); const [ciclos, setCiclos] = useState<Ciclo[]>([]);
  const [formMateria, setFormMateria] = useState(MATERIA); const [formCiclo, setFormCiclo] = useState(CICLO);
  const [editarMateria, setEditarMateria] = useState<number | null>(null); const [editarCiclo, setEditarCiclo] = useState<number | null>(null);
  const [error, setError] = useState(''); const [mensaje, setMensaje] = useState(''); const [enviando, setEnviando] = useState(false);
  const [resumen, setResumen] = useState<ResumenCierre | null>(null); const { tieneRol } = useAuth();
  const [cargandoCatalogos, setCargandoCatalogos] = useState(true);
  const [params, setParams] = useSearchParams();
  const pagina = Math.max(1, Number(params.get('pagina')) || 1);
  const buscar = params.get('buscar') || '';
  const [termino, setTermino] = useState(buscar), [total, setTotal] = useState(0);
  const consulta = useRef(0);
  useEffect(() => { setTermino(buscar); }, [buscar]);
  useEffect(() => {
    if (termino === buscar) return;
    const timer = setTimeout(() => setParams(prev => {
      const next = new URLSearchParams(prev); next.delete('pagina');
      if (termino.trim()) next.set('buscar', termino.trim()); else next.delete('buscar');
      return next;
    }, { replace: true }), 300);
    return () => clearTimeout(timer);
  }, [termino, buscar, setParams]);
  const cargar = useCallback(async () => {
    const actual = ++consulta.current; setCargandoCatalogos(true);
    try {
      const [m, c] = await Promise.all([api.get<{ datos: Materia[]; total: number }>('/academico/materias/listado', { params: { pagina, porPagina: 10, buscar } }), api.get<Ciclo[]>('/academico/ciclos')]);
      if (actual !== consulta.current) return;
      setMaterias(m.data.datos); setTotal(m.data.total); setCiclos(c.data); setError('');
    } catch (err) { if (actual === consulta.current) setError(mensajeDeError(err)); }
    finally { if (actual === consulta.current) setCargandoCatalogos(false); }
  }, [pagina, buscar]);
  useEffect(() => { void cargar(); return () => { consulta.current++; }; }, [cargar]);
  const operar = async (trabajo: () => Promise<void>, anunciar = true) => { if (enviando) return; setEnviando(true); setError(''); setMensaje('');
    try { await trabajo(); await cargar(); if (anunciar) setMensaje('Operación completada'); } catch (err) { setError(mensajeDeError(err)); } finally { setEnviando(false); } };
  const guardarMateria = (e: FormEvent) => { e.preventDefault(); void operar(async () => {
    const datos = { ...formMateria, creditos: Number(formMateria.creditos) };
    if (editarMateria) await api.patch(`/academico/materias/${editarMateria}`, datos); else await api.post('/academico/materias', datos);
    setEditarMateria(null); setFormMateria(MATERIA);
  }); };
  const guardarCiclo = (e: FormEvent) => { e.preventDefault(); void operar(async () => {
    if (editarCiclo) await api.patch(`/academico/ciclos/${editarCiclo}`, formCiclo); else await api.post('/academico/ciclos', formCiclo);
    setEditarCiclo(null); setFormCiclo(CICLO);
  }); };
  const transicion = (c: Ciclo, accion: string) => { void operar(async () => {
    const { data } = await api.get<ResumenCierre>(`/academico/ciclos/${c.id}/cierre`); setResumen(data);
    if (accion === 'cerrar' && !data.puedeCerrar) throw new Error('Completa las notas y cierra P1-P3 antes de cerrar el ciclo.');
    dialogo.abrir({ titulo: `Confirmar ${accion}`, minimo: 1, maximo: 20,
      advertencia: `Grupos: ${data.grupos}; clases: ${data.clases}; inscritos: ${data.inscritos}. Escribe ${c.clave} para confirmar.`,
      ejecutar: async (valor) => {
        if (valor !== c.clave) throw new Error(`Escribe exactamente ${c.clave} para confirmar.`);
        setEnviando(true);
        try { await api.post(`/academico/ciclos/${c.id}/${accion}`, { confirmado: true }); await cargar(); setMensaje('Operación completada'); }
        finally { setEnviando(false); }
      },
    });
  }, false); };
  return <>{confirmacion.elemento}{dialogo.elemento}<Encabezado titulo="Materias y ciclos" detalle="Preparar un ciclo no cambia el ciclo vigente. Activación y cierre institucional por Superadmin." />
    {error && <p role="alert" className="mensaje-error">{error}</p>}{mensaje && <p role="status">{mensaje}</p>}
    <section className="panel" aria-label="Preparación académica"><h2>Orden de preparación</h2><p>Primero prepara el ciclo y el catálogo de materias; después crea grupos y asigna materias y docentes. Un ciclo en preparación no reemplaza al vigente hasta que SUPERADMIN lo active.</p><ol><li>Prepara el ciclo y registra las materias.</li><li>Crea grupos en el plantel y ciclo; asigna materia y docente.</li><li>Registra expedientes e inscribe alumnos en Grupos.</li></ol><p>PREPARACION permite configurar. ACTIVO es el ciclo vigente para el trabajo académico. EN_CIERRE permite completar notas; CERRADO conserva el historial y bloquea cambios.</p></section>
    <section className="panel"><h2>{editarMateria ? 'Editar materia' : 'Nueva materia'}</h2><form onSubmit={guardarMateria} className="fila">
      <label htmlFor="mat-clave">Clave<input id="mat-clave" required maxLength={20} value={formMateria.clave} onChange={(e) => setFormMateria({ ...formMateria, clave: e.target.value })} /></label>
      <label htmlFor="mat-nombre">Nombre<input id="mat-nombre" required maxLength={120} value={formMateria.nombre} onChange={(e) => setFormMateria({ ...formMateria, nombre: e.target.value })} /></label>
      <label htmlFor="mat-creditos">Créditos<input id="mat-creditos" type="number" min={0} step={1} value={formMateria.creditos} onChange={(e) => setFormMateria({ ...formMateria, creditos: e.target.value })} /></label>
      <label htmlFor="mat-descripcion">Descripción<input id="mat-descripcion" maxLength={300} value={formMateria.descripcion} onChange={(e) => setFormMateria({ ...formMateria, descripcion: e.target.value })} /></label>
      <button disabled={enviando}>Guardar materia</button>{editarMateria && <button type="button" onClick={async () => { setEditarMateria(null); setFormMateria(MATERIA); }}>Cancelar edición</button>}
    </form></section>
    <label htmlFor="buscar-materias">Buscar materias por clave o nombre<input id="buscar-materias" maxLength={120} value={termino} onChange={e => setTermino(e.target.value)} /></label>
    <button type="button" disabled={cargandoCatalogos} onClick={() => void cargar()}>Actualizar catálogo</button>
    {cargandoCatalogos && <p role="status">Cargando catálogo…</p>}
    <div className="tabla-contenedor" role="region" aria-label="Catálogo de materias" tabIndex={0}><table className="tabla tabla-adaptable" aria-busy={cargandoCatalogos}><caption className="solo-lector">Claves, nombres, créditos y acciones del catálogo académico</caption><thead><tr><th scope="col">Clave</th><th scope="col">Materia</th><th scope="col">Créditos</th><th scope="col">Acciones</th></tr></thead><tbody>{materias.map((m) => <tr key={m.id}><td data-etiqueta="Clave">{m.clave}</td><td data-etiqueta="Materia">{m.nombre}</td><td data-etiqueta="Créditos">{m.creditos}</td><td data-etiqueta="Acciones">
      <button disabled={enviando} onClick={async () => { setEditarMateria(m.id); setFormMateria({ clave: m.clave, nombre: m.nombre, creditos: String(m.creditos), descripcion: m.descripcion ?? '' }); }}>Editar</button>
      {tieneRol('SUPERADMIN') && <button disabled={enviando} onClick={async () => { if (await confirmacion.solicitar(`¿Desactivar ${m.nombre}? El historial se conserva.`)) void operar(async () => { await api.delete(`/academico/materias/${m.id}`); }); }}>Desactivar</button>}
    </td></tr>)}{!cargandoCatalogos && !error && !materias.length && <tr><td colSpan={4} className="vacio">No hay materias para esta búsqueda. Ajusta el texto o registra una materia.</td></tr>}</tbody></table></div>
    <Paginador total={total} pagina={pagina} porPagina={10} deshabilitado={cargandoCatalogos} onCambio={p => setParams(prev => { const next = new URLSearchParams(prev); next.set('pagina', String(p)); return next; })} />
    <section className="panel"><h2>{editarCiclo ? 'Editar ciclo' : 'Preparar ciclo escolar'}</h2><form onSubmit={guardarCiclo} className="fila">
      <label htmlFor="cic-clave">Clave del ciclo<input id="cic-clave" required maxLength={20} value={formCiclo.clave} onChange={(e) => setFormCiclo({ ...formCiclo, clave: e.target.value })} /></label>
      <label htmlFor="cic-nombre">Nombre del ciclo<input id="cic-nombre" required maxLength={80} value={formCiclo.nombre} onChange={(e) => setFormCiclo({ ...formCiclo, nombre: e.target.value })} /></label>
      <label htmlFor="cic-inicio">Inicio<input id="cic-inicio" type="date" required value={formCiclo.fechaInicio} onChange={(e) => setFormCiclo({ ...formCiclo, fechaInicio: e.target.value })} /></label>
      <label htmlFor="cic-fin">Fin<input id="cic-fin" type="date" required min={formCiclo.fechaInicio} value={formCiclo.fechaFin} onChange={(e) => setFormCiclo({ ...formCiclo, fechaFin: e.target.value })} /></label>
      <button disabled={enviando}>Guardar ciclo en preparación</button>{editarCiclo && <button type="button" onClick={async () => { setEditarCiclo(null); setFormCiclo(CICLO); }}>Cancelar edición</button>}
    </form></section>
    <div className="tabla-contenedor" role="region" aria-label="Ciclos escolares" tabIndex={0}><table className="tabla tabla-adaptable" aria-busy={cargandoCatalogos}><caption className="solo-lector">Ciclos, periodos, estados y acciones autorizadas</caption><thead><tr><th scope="col">Clave</th><th scope="col">Ciclo</th><th scope="col">Periodo</th><th scope="col">Estado</th><th scope="col">Acciones</th></tr></thead><tbody>{ciclos.map((c) => <tr key={c.id}><td data-etiqueta="Clave">{c.clave}</td><td data-etiqueta="Ciclo">{c.nombre}</td><td data-etiqueta="Periodo">{c.fechaInicio} — {c.fechaFin}</td><td data-etiqueta="Estado">{c.estado}</td><td data-etiqueta="Acciones">
      {c.estado !== 'CERRADO' && <button disabled={enviando} onClick={async () => { setEditarCiclo(c.id); setFormCiclo({ clave: c.clave, nombre: c.nombre, fechaInicio: c.fechaInicio, fechaFin: c.fechaFin }); }}>Editar ciclo</button>}
      {tieneRol('SUPERADMIN') && <>{c.estado === 'PREPARACION' && <button disabled={enviando} onClick={() => transicion(c, 'activar')}>Activar</button>}{c.estado === 'ACTIVO' && <button disabled={enviando} onClick={() => transicion(c, 'iniciar-cierre')}>Iniciar cierre</button>}{c.estado === 'EN_CIERRE' && <button disabled={enviando} onClick={() => transicion(c, 'cerrar')}>Validar y cerrar</button>}</>}
    </td></tr>)}{!cargandoCatalogos && !error && !ciclos.length && <tr><td colSpan={5} className="vacio">No hay ciclos preparados. Registra el primero para organizar grupos.</td></tr>}</tbody></table></div>
    {resumen && <section className="panel"><h2>Resumen de cierre</h2><p>Grupos: {resumen.grupos}; clases: {resumen.clases}; inscritos: {resumen.inscritos}</p>{resumen.faltantes.map((f) => <p key={`${f.grupoId ?? f.grupoMateriaId}-${f.parcial}`}>{f.parcial === 0 ? `Grupo ${f.grupoId} sin materias` : `Clase ${f.grupoMateriaId}, P${f.parcial}` }: {f.sinNota} sin nota; {f.cerrado ? 'cerrado' : 'abierto'}</p>)}</section>}
  </>;
}
