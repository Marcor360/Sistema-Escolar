import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { api, mensajeDeError } from '../api/client';
import { ContextoAcademicoSelector, CONTEXTO_VACIO } from './ContextoAcademicoSelector';
import { Paginador } from './Paginador';
import { useAuth } from '../auth/AuthContext';
import { useConfirmacion } from './useConfirmacion';
interface Vinculo { id: number; periodoAcademico: { nombre: string; plantel: { nombre: string }; ciclo: { nombre: string }; carrera: { nombre: string; versionPlan: string; nivel: { nombre: string } } } }
export function ContextosMateria({ materiaId }: { materiaId: number }) {
  const { tieneRol } = useAuth(), confirmacion = useConfirmacion();
  const [resultado, setResultado] = useState<{ datos: Vinculo[]; total: number }>({ datos: [], total: 0 });
  const [planteles, setPlanteles] = useState<{ id: number; nombre: string }[]>([]), [ciclos, setCiclos] = useState<{ id: number; nombre: string }[]>([]);
  const [pagina, setPagina] = useState(1), [plantelId, setPlantel] = useState(''), [cicloId, setCiclo] = useState(''), [contexto, setContexto] = useState(CONTEXTO_VACIO);
  const [error, setError] = useState(''), [mensaje, setMensaje] = useState(''), [cargando, setCargando] = useState(false), [enviando, setEnviando] = useState(false);
  const consulta = useRef(0);
  const cargar = useCallback(async () => {
    const actual = ++consulta.current; setCargando(true); setError('');
    try { const { data } = await api.get(`/academico/materias/${materiaId}/contextos`, { params: { pagina, porPagina: 10 } }); if (actual === consulta.current) setResultado(data); }
    catch (e) { if (actual === consulta.current) setError(mensajeDeError(e)); }
    finally { if (actual === consulta.current) setCargando(false); }
  }, [materiaId, pagina]);
  const invalidarConsulta = useCallback(() => { consulta.current++; }, []);
  useEffect(() => { void cargar(); return invalidarConsulta; }, [cargar, invalidarConsulta]);
  useEffect(() => {
    if (!tieneRol('ADMINISTRATIVO')) return;
    let vigente = true;
    Promise.all([api.get('/planteles/mios'), api.get('/academico/ciclos')]).then(([p, c]) => { if (vigente) { setPlanteles(p.data); setCiclos(c.data); } }).catch(e => { if (vigente) setError(mensajeDeError(e)); });
    return () => { vigente = false; };
  }, [tieneRol]);
  const vincular = async (e: FormEvent) => {
    e.preventDefault(); if (enviando || !contexto.periodoAcademicoId) return;
    setEnviando(true); setError(''); setMensaje('');
    try { await api.post(`/academico/materias/${materiaId}/contextos`, { periodoAcademicoId: Number(contexto.periodoAcademicoId) }); setContexto(CONTEXTO_VACIO); await cargar(); setMensaje('Periodo vinculado'); }
    catch (e) { setError(mensajeDeError(e)); } finally { setEnviando(false); }
  };
  return <section className="panel" aria-label="Planes y periodos de la materia">{confirmacion.elemento}<h2>Planes y periodos de la materia</h2>
    <p>Vincula los periodos de los planes que incluyen esta materia. Las clases existentes conservan su grupo, docente e historial.</p>
    {error && <p role="alert">{error}</p>}{mensaje && <p role="status">{mensaje}</p>}{cargando && <p role="status">Cargando vínculos…</p>}
    {tieneRol('ADMINISTRATIVO') && <form onSubmit={vincular}><fieldset disabled={enviando}><legend>Vincular periodo existente</legend>
      <label>Plantel<select value={plantelId} onChange={e => { setPlantel(e.target.value); setContexto(CONTEXTO_VACIO); }}><option value="">Selecciona…</option>{planteles.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}</select></label>
      <label>Ciclo<select value={cicloId} onChange={e => { setCiclo(e.target.value); setContexto(CONTEXTO_VACIO); }}><option value="">Selecciona…</option>{ciclos.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select></label>
      <ContextoAcademicoSelector plantelId={plantelId} cicloId={cicloId} valor={contexto} cambiar={setContexto} />
      <button disabled={!contexto.periodoAcademicoId}>Vincular periodo</button></fieldset></form>}
    <button disabled={cargando} onClick={() => void cargar()}>Actualizar vínculos</button>
    {resultado.datos.map(v => <article key={v.id}><p>{v.periodoAcademico.plantel.nombre} · {v.periodoAcademico.carrera.nivel.nombre} · {v.periodoAcademico.carrera.nombre} · Plan {v.periodoAcademico.carrera.versionPlan} · {v.periodoAcademico.nombre} · {v.periodoAcademico.ciclo.nombre}</p>
      {tieneRol('ADMINISTRATIVO') && <button disabled={enviando} onClick={async () => {
        if (!await confirmacion.solicitar('¿Retirar este vínculo del catálogo? Las clases y el historial se conservan.')) return;
        setEnviando(true); setError(''); try { await api.delete(`/academico/materias/${materiaId}/contextos/${v.id}`); await cargar(); } catch (e) { setError(mensajeDeError(e)); } finally { setEnviando(false); }
      }}>Retirar vínculo</button>}</article>)}
    {!cargando && !error && resultado.total === 0 && <p>Sin periodos vinculados en tu alcance.</p>}
    <Paginador total={resultado.total} pagina={pagina} porPagina={10} onCambio={setPagina} deshabilitado={cargando} />
  </section>;
}
