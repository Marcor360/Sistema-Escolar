import { FormEvent, useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { api, mensajeDeError } from '../api/client';
import { Paginador } from '../components/Paginador';
import { Encabezado } from '../components/Encabezado';
import { useAuth } from '../auth/AuthContext';
interface Ficha {
  ciclo: { id: number; clave: string; nombre: string; fechaInicio: string; fechaFin: string; estado: string };
  resumen: Record<string, number>;
  datos: { id: number; nombre: string; tipo: string; turno: string | null; activo: boolean; plantel: { nombre: string }; nivel: string | null; carrera: string | null; plan: string | null; periodo: string | null }[];
  total: number; pagina: number; porPagina: number;
  clases: { datos: { id: number; grupo: string; materia: string; clave: string; docente: { nombre: string } | null }[]; total: number; pagina: number; porPagina: number };
}
export default function CicloFichaPage() {
  const { id } = useParams(), [q, setQ] = useSearchParams(), { tieneRol } = useAuth();
  const [ficha, setFicha] = useState<Ficha | null>(null), [error, setError] = useState(''), [cargando, setCargando] = useState(true), [intento, setIntento] = useState(0), [buscar, setBuscar] = useState(q.get('buscar') || '');
  const pagina = Number(q.get('pagina')) || 1, clasesPagina = Number(q.get('clasesPagina')) || 1, termino = q.get('buscar') || '';
  useEffect(() => { let vigente = true; setCargando(true); setFicha(null); setError(''); api.get<Ficha>(`/academico/ciclos/${id}/ficha`, { params: { pagina, clasesPagina, buscar: termino, porPagina: 10 } }).then(r => { if (vigente) setFicha(r.data); }).catch(e => { if (vigente) setError(mensajeDeError(e)); }).finally(() => { if (vigente) setCargando(false); }); return () => { vigente = false; }; }, [id, pagina, clasesPagina, termino, intento]);
  const filtrar = (e: FormEvent) => { e.preventDefault(); setQ({ buscar }); };
  return <><Encabezado titulo="Ficha del ciclo" detalle="Oferta académica real dentro de tu alcance autorizado" /><Link to={tieneRol('ADMINISTRATIVO') ? '/materias?vista=ciclos' : tieneRol('MAESTRO') ? '/maestro' : '/'}>Volver</Link>
    <form onSubmit={filtrar}><label htmlFor="ficha-buscar">Buscar grupo</label><input id="ficha-buscar" value={buscar} onChange={e => setBuscar(e.target.value)} maxLength={80} /><button disabled={cargando}>Buscar</button></form>
    {cargando && <p role="status">Cargando ficha del ciclo…</p>}{error && <p role="alert">{error}<button onClick={() => setIntento(v => v + 1)}>Reintentar</button></p>}
    {ficha && <><section className="panel"><h2>{ficha.ciclo.clave} · {ficha.ciclo.nombre}</h2><p>{ficha.ciclo.fechaInicio} — {ficha.ciclo.fechaFin} · {ficha.ciclo.estado}</p><p>Conteos de la oferta asignada a grupos dentro de tu alcance y búsqueda. Los grupos históricos se identifican como inactivos.</p><dl>{Object.entries(ficha.resumen).map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl></section>
      <section className="panel"><h2>Grupos y contexto académico</h2><Paginador total={ficha.total} pagina={pagina} porPagina={10} deshabilitado={cargando} onCambio={p => setQ(prev => { const n = new URLSearchParams(prev); n.set('pagina', String(p)); return n; })} />
        {ficha.datos.length === 0 && <p>Sin grupos en este ciclo para tu consulta.</p>}{ficha.datos.map(g => <article key={g.id}><h3>{g.nombre} · {g.plantel.nombre}</h3><p>{g.nivel || 'Sin nivel registrado'} · {g.carrera || 'Sin carrera registrada'} · {g.plan || 'Sin plan registrado'} · {g.periodo || 'Sin periodo registrado'}</p><p>{g.tipo} · {g.turno || 'Sin turno registrado'} · {g.activo ? 'Activo' : 'Inactivo'}</p>{tieneRol('ADMINISTRATIVO') && <Link to={`/grupos?vista=administrar&id=${g.id}`}>Gestionar grupo {g.nombre}</Link>}</article>)}
      </section><section className="panel"><h2>Asignaturas y docentes</h2><Paginador total={ficha.clases.total} pagina={clasesPagina} porPagina={10} deshabilitado={cargando} onCambio={p => setQ(prev => { const n = new URLSearchParams(prev); n.set('clasesPagina', String(p)); return n; })} />
        {ficha.clases.datos.length === 0 && <p>Sin asignaturas visibles en este ciclo.</p>}{ficha.clases.datos.map(c => <article key={c.id}><h3>{c.grupo} · {c.clave} {c.materia}</h3><p>{c.docente?.nombre || 'Sin docente asignado'} · Clase {c.id}</p>{tieneRol('MAESTRO', 'ADMINISTRATIVO') && <Link to={`/temarios?vista=consulta&clase=${c.id}`}>Consultar temario de {c.materia}</Link>}</article>)}
      </section></>}
  </>;
}
