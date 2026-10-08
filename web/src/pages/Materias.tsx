import { useConfirmacion } from '../components/useConfirmacion';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { api, mensajeDeError } from '../api/client';
import { Encabezado } from '../components/Encabezado';
import { useAuth } from '../auth/AuthContext';
interface Materia { id: number; clave: string; nombre: string; creditos: number; descripcion?: string }
interface Ciclo { id: number; clave: string; nombre: string; activo: boolean; estado: string; fechaInicio: string; fechaFin: string }
interface ResumenCierre { grupos: number; clases: number; inscritos: number; puedeCerrar: boolean; faltantes: { grupoId?: number; grupoMateriaId: number; parcial: number; sinNota: number; cerrado: boolean }[] }
const MATERIA = { clave: '', nombre: '', creditos: '0', descripcion: '' };
const CICLO = { clave: '', nombre: '', fechaInicio: '', fechaFin: '' };
export default function MateriasPage() {
  const confirmacion = useConfirmacion();
  const [materias, setMaterias] = useState<Materia[]>([]); const [ciclos, setCiclos] = useState<Ciclo[]>([]);
  const [formMateria, setFormMateria] = useState(MATERIA); const [formCiclo, setFormCiclo] = useState(CICLO);
  const [editarMateria, setEditarMateria] = useState<number | null>(null); const [editarCiclo, setEditarCiclo] = useState<number | null>(null);
  const [error, setError] = useState(''); const [mensaje, setMensaje] = useState(''); const [enviando, setEnviando] = useState(false);
  const [resumen, setResumen] = useState<ResumenCierre | null>(null); const { tieneRol } = useAuth();
  const cargar = useCallback(async () => { const [m, c] = await Promise.all([api.get<Materia[]>('/academico/materias'), api.get<Ciclo[]>('/academico/ciclos')]); setMaterias(m.data); setCiclos(c.data); }, []);
  useEffect(() => { void cargar().catch((err) => setError(mensajeDeError(err))); }, [cargar]);
  const operar = async (trabajo: () => Promise<void>) => { if (enviando) return; setEnviando(true); setError(''); setMensaje('');
    try { await trabajo(); await cargar(); setMensaje('Operación completada'); } catch (err) { setError(mensajeDeError(err)); } finally { setEnviando(false); } };
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
    if (prompt(`Acción: ${accion}. Grupos: ${data.grupos}; clases: ${data.clases}; inscritos: ${data.inscritos}. Escribe ${c.clave} para confirmar.`) !== c.clave) return;
    await api.post(`/academico/ciclos/${c.id}/${accion}`, { confirmado: true });
  }); };
  return <>{confirmacion.elemento}<Encabezado titulo="Materias y ciclos" detalle="Preparar un ciclo no cambia el ciclo vigente. Activación y cierre institucional por Superadmin." />
    {error && <p role="alert" className="mensaje-error">{error}</p>}{mensaje && <p role="status">{mensaje}</p>}
    <section className="panel"><h2>{editarMateria ? 'Editar materia' : 'Nueva materia'}</h2><form onSubmit={guardarMateria} className="fila">
      <label htmlFor="mat-clave">Clave<input id="mat-clave" required maxLength={20} value={formMateria.clave} onChange={(e) => setFormMateria({ ...formMateria, clave: e.target.value })} /></label>
      <label htmlFor="mat-nombre">Nombre<input id="mat-nombre" required maxLength={120} value={formMateria.nombre} onChange={(e) => setFormMateria({ ...formMateria, nombre: e.target.value })} /></label>
      <label htmlFor="mat-creditos">Créditos<input id="mat-creditos" type="number" min={0} step={1} value={formMateria.creditos} onChange={(e) => setFormMateria({ ...formMateria, creditos: e.target.value })} /></label>
      <label htmlFor="mat-descripcion">Descripción<input id="mat-descripcion" maxLength={300} value={formMateria.descripcion} onChange={(e) => setFormMateria({ ...formMateria, descripcion: e.target.value })} /></label>
      <button disabled={enviando}>Guardar materia</button>{editarMateria && <button type="button" onClick={async () => { setEditarMateria(null); setFormMateria(MATERIA); }}>Cancelar edición</button>}
    </form></section>
    <table className="tabla"><thead><tr><th>Clave</th><th>Materia</th><th>Créditos</th><th>Acciones</th></tr></thead><tbody>{materias.map((m) => <tr key={m.id}><td>{m.clave}</td><td>{m.nombre}</td><td>{m.creditos}</td><td>
      <button disabled={enviando} onClick={async () => { setEditarMateria(m.id); setFormMateria({ clave: m.clave, nombre: m.nombre, creditos: String(m.creditos), descripcion: m.descripcion ?? '' }); }}>Editar</button>
      <button disabled={enviando} onClick={async () => { if (await confirmacion.solicitar(`¿Desactivar ${m.nombre}? El historial se conserva.`)) void operar(async () => { await api.delete(`/academico/materias/${m.id}`); }); }}>Desactivar</button>
    </td></tr>)}</tbody></table>
    <section className="panel"><h2>{editarCiclo ? 'Editar ciclo' : 'Preparar ciclo escolar'}</h2><form onSubmit={guardarCiclo} className="fila">
      <label htmlFor="cic-clave">Clave del ciclo<input id="cic-clave" required maxLength={20} value={formCiclo.clave} onChange={(e) => setFormCiclo({ ...formCiclo, clave: e.target.value })} /></label>
      <label htmlFor="cic-nombre">Nombre del ciclo<input id="cic-nombre" required maxLength={80} value={formCiclo.nombre} onChange={(e) => setFormCiclo({ ...formCiclo, nombre: e.target.value })} /></label>
      <label htmlFor="cic-inicio">Inicio<input id="cic-inicio" type="date" required value={formCiclo.fechaInicio} onChange={(e) => setFormCiclo({ ...formCiclo, fechaInicio: e.target.value })} /></label>
      <label htmlFor="cic-fin">Fin<input id="cic-fin" type="date" required min={formCiclo.fechaInicio} value={formCiclo.fechaFin} onChange={(e) => setFormCiclo({ ...formCiclo, fechaFin: e.target.value })} /></label>
      <button disabled={enviando}>Guardar ciclo en preparación</button>{editarCiclo && <button type="button" onClick={async () => { setEditarCiclo(null); setFormCiclo(CICLO); }}>Cancelar edición</button>}
    </form></section>
    <table className="tabla"><thead><tr><th>Clave</th><th>Ciclo</th><th>Periodo</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>{ciclos.map((c) => <tr key={c.id}><td>{c.clave}</td><td>{c.nombre}</td><td>{c.fechaInicio} — {c.fechaFin}</td><td>{c.estado}</td><td>
      {c.estado !== 'CERRADO' && <button disabled={enviando} onClick={async () => { setEditarCiclo(c.id); setFormCiclo({ clave: c.clave, nombre: c.nombre, fechaInicio: c.fechaInicio, fechaFin: c.fechaFin }); }}>Editar ciclo</button>}
      {tieneRol('SUPERADMIN') && <>{c.estado === 'PREPARACION' && <button disabled={enviando} onClick={() => transicion(c, 'activar')}>Activar</button>}{c.estado === 'ACTIVO' && <button disabled={enviando} onClick={() => transicion(c, 'iniciar-cierre')}>Iniciar cierre</button>}{c.estado === 'EN_CIERRE' && <button disabled={enviando} onClick={() => transicion(c, 'cerrar')}>Validar y cerrar</button>}</>}
    </td></tr>)}</tbody></table>
    {resumen && <section className="panel"><h2>Resumen de cierre</h2><p>Grupos: {resumen.grupos}; clases: {resumen.clases}; inscritos: {resumen.inscritos}</p>{resumen.faltantes.map((f) => <p key={`${f.grupoId ?? f.grupoMateriaId}-${f.parcial}`}>{f.parcial === 0 ? `Grupo ${f.grupoId} sin materias` : `Clase ${f.grupoMateriaId}, P${f.parcial}` }: {f.sinNota} sin nota; {f.cerrado ? 'cerrado' : 'abierto'}</p>)}</section>}
  </>;
}
