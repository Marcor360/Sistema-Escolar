import { useDialogoMotivo } from '../components/useDialogoMotivo';
import { FormEvent, useRef, useState } from 'react';
import { abrirArchivo, api, mensajeDeError } from '../api/client';
import { Encabezado } from '../components/Encabezado';
import { useDatos } from '../hooks/useDatos';
import { fecha, fechaHora } from '../utils/formato';

interface GrupoMateria {
  id: number;
  grupo: { nombre: string; ciclo: { clave: string } };
  materia: { clave: string; nombre: string };
}
interface Actividad {
  id: number; titulo: string; tipo: string; parcial: number;
  descripcion?: string; ponderacion: number; fechaEntrega: string | null;
}
interface Material {
  id: number; titulo: string; archivoNombre: string; archivoRuta: string;
  tamanoKb: number; createdAt: string;
}
interface Entrega {
  id: number; estatus: string; calificacion: number | null;
  archivoRuta: string | null; comentarioAlumno: string | null; comentarioDocente: string | null; fechaEntregado: string;
  alumno: { matricula: string; usuario: { nombre: string; apellidoPaterno: string } };
}

const FORM_INICIAL = { titulo: '', descripcion: '', tipo: 'TAREA', parcial: '1', ponderacion: '0', fechaEntrega: '' };

export default function MaestroPage() {
  const dialogoMotivo = useDialogoMotivo();
  const { datos: clases, cargando } = useDatos<GrupoMateria[]>(
    () => api.get('/academico/mis-grupos').then((r) => r.data),
    [],
  );
  const [claseActiva, setClaseActiva] = useState<GrupoMateria | null>(null);
  const [actividades, setActividades] = useState<Actividad[]>([]);
  const [actividadActiva, setActividadActiva] = useState<Actividad | null>(null);
  const [entregas, setEntregas] = useState<Entrega[] | null>(null);
  const [notas, setNotas] = useState<Record<number, string>>({});
  const [guardadas, setGuardadas] = useState<Set<number>>(new Set());
  const [form, setForm] = useState(FORM_INICIAL);
  const [materiales, setMateriales] = useState<Material[]>([]);
  const [tituloMaterial, setTituloMaterial] = useState('');
  const archivoMaterial = useRef<HTMLInputElement>(null);
  const [error, setError] = useState('');
  const [editandoActividad, setEditandoActividad] = useState<number | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [comentarios, setComentarios] = useState<Record<number, string>>({});

  const abrirClase = async (clase: GrupoMateria) => {
    setClaseActiva(clase);
    setEntregas(null);
    setActividadActiva(null);
    setError('');
    setActividades([]);
    setMateriales([]);
    try {
      const [acts, mats] = await Promise.all([
        api.get<Actividad[]>(`/grupo-materias/${clase.id}/actividades`),
        api.get<Material[]>(`/grupo-materias/${clase.id}/materiales`),
      ]);
      setActividades(acts.data);
      setMateriales(mats.data);
    } catch (err) { setError(mensajeDeError(err)); }
  };

  /** Sube material de apoyo (PDF, documentos, imágenes) para la clase activa. */
  const subirMaterial = async (e: FormEvent) => {
    e.preventDefault();
    const archivo = archivoMaterial.current?.files?.[0];
    if (!claseActiva || !archivo || enviando) return;
    setEnviando(true);
    setError('');
    const datos = new FormData();
    datos.append('archivo', archivo);
    datos.append('titulo', tituloMaterial || archivo.name);
    try {
      await api.post(`/grupo-materias/${claseActiva.id}/materiales`, datos, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setTituloMaterial('');
      if (archivoMaterial.current) archivoMaterial.current.value = '';
      const { data } = await api.get<Material[]>(`/grupo-materias/${claseActiva.id}/materiales`);
      setMateriales(data);
    } catch (err) { setError(mensajeDeError(err)); } finally { setEnviando(false); }
  };

  const crearActividad = async (e: FormEvent) => {
    e.preventDefault();
    if (!claseActiva || enviando) return;
    setEnviando(true); setError('');
    try {
      const datos = {
        grupoMateriaId: claseActiva.id,
        titulo: form.titulo, descripcion: form.descripcion,
        tipo: form.tipo,
        parcial: Number(form.parcial),
        ponderacion: Number(form.ponderacion),
        fechaEntrega: form.fechaEntrega ? new Date(form.fechaEntrega).toISOString() : null,
      };
      if (editandoActividad) await api.patch(`/actividades/${editandoActividad}`, datos);
      else await api.post('/actividades', datos);
      setEditandoActividad(null); setForm(FORM_INICIAL);
      await abrirClase(claseActiva);
    } catch (err) { setError(mensajeDeError(err)); } finally { setEnviando(false); }
  };

  const verEntregas = async (actividad: Actividad) => {
    setActividadActiva(actividad);
    const { data } = await api.get<Entrega[]>(`/actividades/${actividad.id}/entregas`);
    setEntregas(data);
    setNotas(Object.fromEntries(data.map((e) => [e.id, e.calificacion?.toString() ?? ''])));
    setGuardadas(new Set());
    setComentarios(Object.fromEntries(data.map((e) => [e.id, e.comentarioDocente ?? ''])));
  };

  /** Guarda la calificación capturada en la propia fila. */
  const guardarNota = async (entrega: Entrega) => {
    if (enviando) return;
    const valor = notas[entrega.id];
    if (valor === '' || valor === undefined) return;
    setEnviando(true); setError('');
    try {
      await api.patch(`/entregas/${entrega.id}/calificar`, { calificacion: Number(valor), comentario: comentarios[entrega.id] ?? '' });
      setGuardadas((previas) => new Set(previas).add(entrega.id));
      setEntregas((previas) =>
        previas?.map((e) =>
          e.id === entrega.id ? { ...e, calificacion: Number(valor), estatus: 'CALIFICADA', comentarioDocente: comentarios[entrega.id] ?? '' } : e,
        ) ?? null,
      );
    } catch (err) { setError(mensajeDeError(err)); } finally { setEnviando(false); }
  };

  return (
    <>{dialogoMotivo.elemento}
      <Encabezado titulo="Mis clases" detalle="Actividades, entregas y calificación por grupo-materia" />
      {error && <p className="mensaje-error">{error}</p>}

      <table className="tabla" style={{ marginBottom: 24 }}>
        <thead><tr><th>Ciclo</th><th>Grupo</th><th>Materia</th><th /></tr></thead>
        <tbody>
          {clases.map((c) => (
            <tr key={c.id}>
              <td>{c.grupo.ciclo.clave}</td><td>{c.grupo.nombre}</td>
              <td>{c.materia.clave} — {c.materia.nombre}</td>
              <td className="derecha">
                <button className="boton secundario chico" onClick={() => abrirClase(c)}>Abrir</button>
              </td>
            </tr>
          ))}
          {!cargando && clases.length === 0 && (
            <tr><td className="vacio" colSpan={4}>Aún no tienes materias asignadas. Solicítalo a control escolar.</td></tr>
          )}
        </tbody>
      </table>

      {claseActiva && (
        <section className="panel">
          <h2>Actividades — {claseActiva.grupo.nombre} · {claseActiva.materia.nombre}</h2>
          <form onSubmit={crearActividad} className="fila" style={{ marginBottom: 14 }}>
            <div className="campo"><label htmlFor="maestro-campo-1">Título</label>
              <input id="maestro-campo-1" required value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} />
            </div>
            <div className="campo"><label htmlFor="descripcion-actividad">Descripción</label><textarea id="descripcion-actividad" maxLength={4000} value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} /></div><div className="campo"><label htmlFor="maestro-campo-2">Tipo</label>
              <select id="maestro-campo-2" value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>
                <option>TAREA</option><option>EXAMEN</option><option>PROYECTO</option><option>PARTICIPACION</option>
              </select>
            </div>
            <div className="campo"><label htmlFor="maestro-campo-3">Parcial</label>
              <select id="maestro-campo-3" value={form.parcial} onChange={(e) => setForm({ ...form, parcial: e.target.value })}>
                <option value="1">1</option><option value="2">2</option><option value="3">3</option>
              </select>
            </div>
            <div className="campo"><label htmlFor="maestro-campo-4">Peso de seguimiento (sin efecto en la nota oficial)</label>
              <input id="maestro-campo-4" type="number" min={0} max={100} value={form.ponderacion} onChange={(e) => setForm({ ...form, ponderacion: e.target.value })} />
            </div>
            <div className="campo"><label htmlFor="maestro-campo-5">Fecha de entrega</label>
              <input id="maestro-campo-5" type="datetime-local" value={form.fechaEntrega} onChange={(e) => setForm({ ...form, fechaEntrega: e.target.value })} />
            </div>
            <button disabled={enviando} className="boton">{editandoActividad ? 'Guardar corrección' : 'Crear actividad'}</button>
          </form>

          <table className="tabla">
            <thead><tr><th>Actividad</th><th>Tipo</th><th>Parcial</th><th>Entrega</th><th /></tr></thead>
            <tbody>
              {actividades.map((a) => (
                <tr key={a.id}>
                  <td>{a.titulo}</td><td>{a.tipo}</td><td>{a.parcial}</td>
                  <td>{a.fechaEntrega ? fechaHora(a.fechaEntrega) : 'Sin fecha'}</td>
                  <td className="derecha">
                    <button disabled={enviando} className="boton secundario chico" onClick={() => verEntregas(a)}>Entregas</button>
                    <button disabled={enviando} onClick={() => { setEditandoActividad(a.id); setForm({ titulo: a.titulo, descripcion: a.descripcion ?? '', tipo: a.tipo, parcial: String(a.parcial), ponderacion: String(a.ponderacion), fechaEntrega: a.fechaEntrega ? new Date(new Date(a.fechaEntrega).getTime() - new Date(a.fechaEntrega).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '' }); }}>Editar actividad</button>
                    <button disabled={enviando} onClick={async () => { if (!claseActiva || !confirm('¿Desactivar esta actividad? Se conserva el historial.')) return; setEnviando(true); try { await api.delete(`/actividades/${a.id}`); await abrirClase(claseActiva); } catch (err) { setError(mensajeDeError(err)); } finally { setEnviando(false); } }}>Desactivar</button>
                  </td>
                </tr>
              ))}
              {actividades.length === 0 && (
                <tr><td className="vacio" colSpan={5}>Sin actividades. Crea la primera arriba.</td></tr>
              )}
            </tbody>
          </table>
        </section>
      )}

      {claseActiva && (
        <section className="panel">
          <h2>Materiales de clase — {claseActiva.materia.nombre}</h2>
          <form onSubmit={subirMaterial} className="fila" style={{ marginBottom: 14 }}>
            <div className="campo"><label htmlFor="maestro-campo-6">Título</label>
              <input id="maestro-campo-6" value={tituloMaterial} onChange={(e) => setTituloMaterial(e.target.value)} placeholder="Guía del parcial 1" />
            </div>
            <div className="campo"><label htmlFor="maestro-campo-7">Archivo (PDF, Office, imagen · máx. 5 MB)</label>
              <input id="maestro-campo-7" type="file" ref={archivoMaterial} required accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.png,.jpg,.jpeg,.zip,.txt" />
            </div>
            <button disabled={enviando} className="boton">Subir material</button>
          </form>
          <table className="tabla">
            <thead><tr><th>Título</th><th>Archivo</th><th>Tamaño</th><th>Fecha</th></tr></thead>
            <tbody>
              {materiales.map((m) => (
                <tr key={m.id}>
                  <td>{m.titulo}</td>
                  <td><button className="enlace" onClick={() => abrirArchivo('materiales', m.id)}>{m.archivoNombre}</button></td>
                  <td>{m.tamanoKb} KB</td>
                  <td>{fecha(m.createdAt)}
                    <button disabled={enviando} onClick={() => { if (!claseActiva) return; dialogoMotivo.abrir({ titulo: 'Corregir título del material', inicial: m.titulo, minimo: 1, maximo: 150, ejecutar: async (titulo) => { await api.patch(`/materiales/${m.id}`, { titulo }); await abrirClase(claseActiva); } }); }}>Corregir título</button>
                    <button disabled={enviando} onClick={async () => { if (!claseActiva || !confirm('¿Retirar material y eliminar su archivo?')) return; setEnviando(true); try { await api.delete(`/materiales/${m.id}`); await abrirClase(claseActiva); } catch (err) { setError(mensajeDeError(err)); } finally { setEnviando(false); } }}>Retirar material</button>
                  </td>
                </tr>
              ))}
              {materiales.length === 0 && (
                <tr><td className="vacio" colSpan={4}>Sin materiales. Sube el primero: los alumnos lo verán en su app.</td></tr>
              )}
            </tbody>
          </table>
        </section>
      )}

      {entregas && actividadActiva && (
        <section className="panel">
          <h2>Entregas — {actividadActiva.titulo}</h2>
          <table className="tabla">
            <thead>
              <tr><th>Alumno</th><th>Fecha</th><th>Estatus</th><th>Archivo</th><th style={{ width: 190 }}>Calificación</th></tr>
            </thead>
            <tbody>
              {entregas.map((e) => (
                <tr key={e.id} title={e.comentarioAlumno ?? undefined}>
                  <td>{e.alumno.matricula} — {e.alumno.usuario.nombre} {e.alumno.usuario.apellidoPaterno}<p>Comentario del alumno: {e.comentarioAlumno ?? 'Sin comentario'}</p></td>
                  <td>{fechaHora(e.fechaEntregado)}</td>
                  <td>
                    <span className={`sello ${e.estatus === 'CALIFICADA' ? 'ok' : e.estatus === 'TARDE' ? 'mal' : 'aviso'}`}>
                      {e.estatus}
                    </span>
                  </td>
                  <td>{e.archivoRuta ? <button className="enlace" onClick={() => abrirArchivo('entregas', e.id)}>Ver archivo</button> : '—'}</td>
                  <td>
                    <label htmlFor={`feedback-${e.id}`}>Retroalimentación</label><textarea id={`feedback-${e.id}`} maxLength={500} value={comentarios[e.id] ?? ''} onChange={(ev) => setComentarios({ ...comentarios, [e.id]: ev.target.value })} />
                    <span className="captura-nota">
                      <input
                        type="number" min={0} max={100} step={0.1}
                        value={notas[e.id] ?? ''}
                        onChange={(ev) => setNotas({ ...notas, [e.id]: ev.target.value })}
                      />
                      <button disabled={enviando} className="boton chico" onClick={() => guardarNota(e)}>
                        {guardadas.has(e.id) ? '✓' : 'Guardar'}
                      </button>
                    </span>
                  </td>
                </tr>
              ))}
              {entregas.length === 0 && (
                <tr><td className="vacio" colSpan={5}>Aún no hay entregas de los alumnos.</td></tr>
              )}
            </tbody>
          </table>
        </section>
      )}
    </>
  );
}
