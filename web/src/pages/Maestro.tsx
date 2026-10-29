import './temarios.css';
import { FormEvent, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, abrirArchivo, mensajeDeError } from '../api/client';
import { useModuloTrabajo } from '../components/ModuloTrabajo';
import { Encabezado } from '../components/Encabezado';
import { SelectorBuscable } from '../components/SelectorBuscable';
import { Paginador } from '../components/Paginador';
import { useConfirmacion } from '../components/useConfirmacion';
import type { GrupoMateria, Actividad, Material, Entrega } from '../features/maestro/tipos';
const INICIAL = { titulo: '', descripcion: '', tipo: 'TAREA', parcial: '1', ponderacion: '0', fechaEntrega: '' };
export default function MaestroPage() {
  const [q, setQ] = useSearchParams(),
    [listo, setListo] = useState(false),
    [cargando, setCargando] = useState(false),
    [enviando, setEnviando] = useState(false),
    [error, setError] = useState(''),
    [intento, setIntento] = useState(0);
  const trabajo = useModuloTrabajo(cargando || enviando),
    modo = trabajo.modo,
    id = trabajo.id,
    claseId = q.get('clase') || '',
    actividadId = q.get('actividad') || '';
  const pagina = Number(q.get(modo + 'Pagina')) || 1,
    buscar = q.get(modo + 'Buscar') || '';
  const [clase, setClase] = useState<GrupoMateria | null>(null),
    [actividades, setActividades] = useState<Actividad[]>([]),
    [materiales, setMateriales] = useState<Material[]>([]),
    [entregas, setEntregas] = useState<Entrega[]>([]),
    [total, setTotal] = useState(0),
    [form, setForm] = useState(INICIAL),
    [titulo, setTitulo] = useState(''),
    [nota, setNota] = useState(''),
    [comentario, setComentario] = useState(''),
    [entrega, setEntrega] = useState<Entrega | null>(null),
    [termino, setTermino] = useState(buscar);
  const archivo = useRef<HTMLInputElement>(null),
    ocupado = useRef(false),
    confirmar = useConfirmacion();
  const ir = (vista: string, registro?: number, extras: Record<string, string> = {}) =>
    setQ((prev) => {
      const n = new URLSearchParams(prev);
      n.set('vista', vista);
      if (registro) n.set('id', String(registro));
      else n.delete('id');
      for (const [k, v] of Object.entries(extras)) {
        if (v) n.set(k, v);
        else n.delete(k);
      }
      return n;
    });
  useEffect(() => {
    let vigente = true;
    setListo(false);
    setError('');
    setClase(null);
    setActividades([]);
    setMateriales([]);
    setEntregas([]);
    setEntrega(null);
    setTotal(0);
    setForm(INICIAL);
    setTitulo('');
    setNota('');
    setComentario('');
    setTermino(buscar);
    setCargando(false);
    if (modo === 'consulta' || !claseId) return;
    setCargando(true);
    void (async () => {
      try {
        const c = await api.get<GrupoMateria>(`/grupo-materias/${claseId}/detalle`);
        if (!vigente) return;
        setClase(c.data);
        if (modo === 'actividades') {
          const r = await api.get(`/grupo-materias/${claseId}/actividades/listado`, {
            params: { pagina, porPagina: 10, buscar },
          });
          if (vigente) {
            setActividades(r.data.datos);
            setTotal(r.data.total);
          }
        }
        if (modo === 'materiales') {
          const r = await api.get(`/grupo-materias/${claseId}/materiales/listado`, {
            params: { pagina, porPagina: 10, buscar },
          });
          if (vigente) {
            setMateriales(r.data.datos);
            setTotal(r.data.total);
          }
        }
        if (modo === 'actividad-editar') {
          const r = await api.get<Actividad & { grupoMateriaId: number }>(`/actividades/${id}`);
          if (r.data.grupoMateriaId !== Number(claseId)) throw new Error('La actividad no corresponde a la clase');
          if (vigente) {
            const a = r.data;
            setForm({
              titulo: a.titulo,
              descripcion: a.descripcion ?? '',
              tipo: a.tipo,
              parcial: String(a.parcial),
              ponderacion: String(a.ponderacion),
              fechaEntrega: a.fechaEntrega
                ? new Date(new Date(a.fechaEntrega).getTime() - new Date(a.fechaEntrega).getTimezoneOffset() * 60000)
                    .toISOString()
                    .slice(0, 16)
                : '',
            });
          }
        }
        if (modo === 'material-editar') {
          const r = await api.get<Material & { grupoMateriaId: number }>(`/materiales/${id}`);
          if (r.data.grupoMateriaId !== Number(claseId)) throw new Error('El material no corresponde a la clase');
          if (vigente) setTitulo(r.data.titulo);
        }
        if (modo === 'entregas' || modo === 'calificar-entrega') {
          const a = await api.get<Actividad & { grupoMateriaId: number }>(`/actividades/${actividadId}`);
          if (a.data.grupoMateriaId !== Number(claseId)) throw new Error('La actividad no corresponde a la clase');
          if (modo === 'entregas') {
            const r = await api.get(`/actividades/${actividadId}/entregas/listado`, {
              params: { pagina, porPagina: 10 },
            });
            if (vigente) {
              setEntregas(r.data.datos);
              setTotal(r.data.total);
            }
          } else {
            const r = await api.get<Entrega & { actividadId: number }>(`/entregas/${id}`);
            if (r.data.actividadId !== Number(actividadId)) throw new Error('La entrega no corresponde a la actividad');
            if (vigente) {
              setEntrega(r.data);
              setNota(r.data.calificacion?.toString() ?? '');
              setComentario(r.data.comentarioDocente ?? '');
            }
          }
        }
        if (vigente) setListo(true);
      } catch (e) {
        if (vigente) setError(mensajeDeError(e));
      } finally {
        if (vigente) setCargando(false);
      }
    })();
    return () => {
      vigente = false;
    };
  }, [modo, id, claseId, actividadId, pagina, buscar, intento]);
  const ejecutar = async (accion: () => Promise<void>, volver?: string) => {
    if (ocupado.current) return;
    ocupado.current = true;
    setEnviando(true);
    setError('');
    try {
      await accion();
      if (volver) {
        trabajo.guardado();
        ir(volver);
      } else setIntento((v) => v + 1);
    } catch (e) {
      setError(mensajeDeError(e));
    } finally {
      ocupado.current = false;
      setEnviando(false);
    }
  };
  const guardarActividad = (e: FormEvent) => {
    e.preventDefault();
    void ejecutar(async () => {
      const datos = {
        titulo: form.titulo,
        descripcion: form.descripcion,
        tipo: form.tipo,
        parcial: Number(form.parcial),
        ponderacion: Number(form.ponderacion),
        fechaEntrega: form.fechaEntrega ? new Date(form.fechaEntrega).toISOString() : null,
      };
      if (modo === 'actividad-editar') await api.patch(`/actividades/${id}`, datos);
      else await api.post('/actividades', { ...datos, grupoMateriaId: Number(claseId) });
    }, 'actividades');
  };
  return (
    <>
      {confirmar.elemento}
      <Encabezado titulo="Mis clases" detalle="Consulta una clase y elige una operación" />
      {error && (
        <p role="alert">
          {error}
          {!['actividad-nueva', 'actividad-editar', 'material-nuevo', 'material-editar', 'calificar-entrega'].includes(
            modo,
          ) && (
            <button disabled={enviando} onClick={() => setIntento((v) => v + 1)}>
              Reintentar
            </button>
          )}
        </p>
      )}
      {cargando && <p role="status">Cargando clase…</p>}
      {modo === 'consulta' && (
        <>
          <SelectorBuscable<GrupoMateria>
            ruta="/academico/clases-seleccion"
            valor={claseId}
            cambiar={(v) => trabajo.actualizar({ clase: v, actividad: '' })}
            etiqueta="Clase asignada"
            texto={(c) =>
              c.grupo.ciclo.clave + ' · ' + c.grupo.nombre + ' · ' + c.materia.clave + ' ' + c.materia.nombre
            }
          />
          <button disabled={!claseId} onClick={() => ir('clase')}>
            Abrir clase
          </button>
        </>
      )}
      {!claseId && modo !== 'consulta' && <p>Selecciona una clase desde la consulta.</p>}
      {clase && (
        <>
          <section className="panel">
            <h2>
              {clase.grupo.nombre} · {clase.materia.nombre}
            </h2>
            <p>
              Clase {clase.id} · Ciclo {clase.grupo.ciclo.clave}
            </p>
            {modo !== 'clase' && (
              <button disabled={cargando || enviando} onClick={() => ir('clase')}>
                Volver a operaciones de la clase
              </button>
            )}
          </section>
          {modo === 'clase' && (
            <section className="panel">
              <h2>Operaciones de esta clase</h2>
              <div className="fila">
                <button onClick={() => ir('actividades')}>Consultar actividades</button>
                <button onClick={() => ir('actividad-nueva')}>Crear actividad</button>
                <button onClick={() => ir('materiales')}>Consultar materiales</button>
                <button onClick={() => ir('material-nuevo')}>Subir material</button>
                <Link to={`/temarios?vista=consulta&clase=${clase.id}`}>Temario de esta clase</Link>
                <Link to={`/recursamientos?clase=${clase.id}`}>Recursantes y notas de esta materia</Link>
                <Link to="/calificaciones">Calificaciones oficiales</Link>
                {clase.grupo.ciclo.id && (
                  <Link to={`/ciclos/${clase.grupo.ciclo.id}`}>Ficha del ciclo de esta clase</Link>
                )}
              </div>
            </section>
          )}
          {['actividades', 'materiales', 'entregas'].includes(modo) && (
            <section className="panel">
              <h2>
                {modo === 'entregas'
                  ? 'Entregas de la actividad ' + actividadId
                  : modo === 'actividades'
                    ? 'Actividades de la clase'
                    : 'Materiales de la clase'}
              </h2>
              {modo !== 'entregas' && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    trabajo.actualizar({ [modo + 'Buscar']: termino, [modo + 'Pagina']: '1' });
                  }}
                >
                  <label htmlFor="maestro-buscar">Buscar título</label>
                  <input
                    id="maestro-buscar"
                    value={termino}
                    maxLength={150}
                    onChange={(e) => setTermino(e.target.value)}
                  />
                  <button disabled={cargando}>Buscar</button>
                </form>
              )}
              <Paginador
                total={total}
                pagina={pagina}
                porPagina={10}
                deshabilitado={cargando || enviando}
                onCambio={(p) => trabajo.actualizar({ [modo + 'Pagina']: String(p) })}
              />
              {!cargando && !error && total === 0 && <p>Sin registros para esta consulta.</p>}
              {modo === 'actividades' &&
                actividades.map((a) => (
                  <article key={a.id}>
                    <h3>{a.titulo}</h3>
                    <p>
                      {a.tipo} · Parcial {a.parcial} ·{' '}
                      {a.fechaEntrega ? new Date(a.fechaEntrega).toLocaleString() : 'Sin fecha'}
                    </p>
                    <button disabled={enviando} onClick={() => ir('actividad-editar', a.id)}>
                      Editar actividad {a.titulo}
                    </button>
                    <button disabled={enviando} onClick={() => ir('entregas', undefined, { actividad: String(a.id) })}>
                      Entregas de {a.titulo}
                    </button>
                    <button
                      disabled={enviando}
                      onClick={async () => {
                        if (await confirmar.solicitar('¿Desactivar esta actividad conservando historial?'))
                          void ejecutar(async () => {
                            await api.delete(`/actividades/${a.id}`);
                          });
                      }}
                    >
                      Desactivar {a.titulo}
                    </button>
                  </article>
                ))}
              {modo === 'materiales' &&
                materiales.map((m) => (
                  <article key={m.id}>
                    <h3>{m.titulo}</h3>
                    <button
                      onClick={() => {
                        void abrirArchivo('materiales', m.id).catch((e) => setError(mensajeDeError(e)));
                      }}
                    >
                      {m.archivoNombre} · {m.tamanoKb} KB
                    </button>
                    <button disabled={enviando} onClick={() => ir('material-editar', m.id)}>
                      Editar título de {m.titulo}
                    </button>
                    <button
                      disabled={enviando}
                      onClick={async () => {
                        if (await confirmar.solicitar('¿Retirar material y su archivo?'))
                          void ejecutar(async () => {
                            await api.delete(`/materiales/${m.id}`);
                          });
                      }}
                    >
                      Retirar {m.titulo}
                    </button>
                  </article>
                ))}
              {modo === 'entregas' &&
                entregas.map((e) => (
                  <article key={e.id}>
                    <h3>
                      {e.alumno.matricula} · {e.alumno.usuario.nombre} {e.alumno.usuario.apellidoPaterno}
                    </h3>
                    <p>
                      {e.estatus} · {e.calificacion ?? 'Sin calificar'}
                    </p>
                    <p>{e.comentarioAlumno || 'Sin comentario del alumno'}</p>
                    {e.respuestaTexto && (
                      <div>
                        <strong>Respuesta escrita</strong>
                        <p style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{e.respuestaTexto}</p>
                      </div>
                    )}
                    {e.archivoRuta && (
                      <button
                        onClick={() => {
                          void abrirArchivo('entregas', e.id).catch((err) => setError(mensajeDeError(err)));
                        }}
                      >
                        Ver archivo de {e.alumno.matricula}
                      </button>
                    )}
                    <button disabled={enviando} onClick={() => ir('calificar-entrega', e.id)}>
                      Calificar entrega de {e.alumno.matricula}
                    </button>
                  </article>
                ))}
            </section>
          )}
          {['actividad-nueva', 'actividad-editar'].includes(modo) && listo && (
            <form className="temario-form" onSubmit={guardarActividad}>
              <fieldset disabled={enviando}>
                <legend>{modo === 'actividad-editar' ? 'Editar actividad' : 'Nueva actividad'}</legend>
                <label htmlFor="actividad-titulo">Título</label>
                <input
                  id="actividad-titulo"
                  required
                  maxLength={150}
                  value={form.titulo}
                  onChange={(e) => setForm({ ...form, titulo: e.target.value })}
                />
                <label htmlFor="actividad-desc">Descripción</label>
                <textarea
                  id="actividad-desc"
                  maxLength={4000}
                  value={form.descripcion}
                  onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
                />
                <label htmlFor="actividad-tipo">Tipo</label>
                <select
                  id="actividad-tipo"
                  value={form.tipo}
                  onChange={(e) => setForm({ ...form, tipo: e.target.value })}
                >
                  {['TAREA', 'EXAMEN', 'PROYECTO', 'PARTICIPACION'].map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
                <label htmlFor="actividad-parcial">Parcial</label>
                <select
                  id="actividad-parcial"
                  value={form.parcial}
                  onChange={(e) => setForm({ ...form, parcial: e.target.value })}
                >
                  {(clase?.regimenEvaluacion === 'CUATRO_PARCIALES_10' ? [0, 1, 2, 3, 4] : [0, 1, 2, 3]).map((p) => (
                    <option key={p} value={p}>
                      {p === 0 ? 'Final' : 'Parcial ' + p}
                    </option>
                  ))}
                </select>
                <label htmlFor="actividad-peso">Peso de seguimiento (sin efecto en la nota oficial)</label>
                <input
                  id="actividad-peso"
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  value={form.ponderacion}
                  onChange={(e) => setForm({ ...form, ponderacion: e.target.value })}
                />
                <label htmlFor="actividad-fecha">Fecha de entrega</label>
                <input
                  id="actividad-fecha"
                  type="datetime-local"
                  value={form.fechaEntrega}
                  onChange={(e) => setForm({ ...form, fechaEntrega: e.target.value })}
                />
                <button disabled={enviando}>
                  {modo === 'actividad-editar' ? 'Guardar corrección' : 'Crear actividad'}
                </button>
              </fieldset>
            </form>
          )}
          {modo === 'material-nuevo' && listo && (
            <form
              className="temario-form"
              onSubmit={(e) => {
                e.preventDefault();
                const a = archivo.current?.files?.[0];
                if (a)
                  void ejecutar(async () => {
                    const datos = new FormData();
                    datos.append('archivo', a);
                    datos.append('titulo', titulo || a.name);
                    await api.post(`/grupo-materias/${claseId}/materiales`, datos);
                  }, 'materiales');
              }}
            >
              <label htmlFor="material-titulo">Título del material</label>
              <input id="material-titulo" maxLength={150} value={titulo} onChange={(e) => setTitulo(e.target.value)} />
              <label htmlFor="material-archivo">Archivo privado del material</label>
              <input id="material-archivo" type="file" required ref={archivo} disabled={enviando} />
              <button disabled={enviando}>Subir material</button>
            </form>
          )}
          {modo === 'material-editar' && listo && (
            <form
              className="temario-form"
              onSubmit={(e) => {
                e.preventDefault();
                void ejecutar(async () => {
                  await api.patch(`/materiales/${id}`, { titulo });
                }, 'materiales');
              }}
            >
              <label htmlFor="material-corregir">Título del material</label>
              <input
                id="material-corregir"
                required
                maxLength={150}
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
              />
              <button disabled={enviando}>Guardar título</button>
            </form>
          )}
          {modo === 'calificar-entrega' && entrega && (
            <form
              className="temario-form"
              onSubmit={(e) => {
                e.preventDefault();
                void ejecutar(async () => {
                  await api.patch(`/entregas/${id}/calificar`, { calificacion: Number(nota), ...(entrega.escalaMaxima === 10 ? {escalaMaxima:10} : {}), comentario });
                }, 'entregas');
              }}
            >
              <p>
                {entrega.alumno.matricula} · {entrega.alumno.usuario.nombre}
              </p>
              <p>{entrega.comentarioAlumno || 'Sin comentario del alumno'}</p>
              {entrega.respuestaTexto && (
                <div>
                  <strong>Respuesta escrita</strong>
                  <p style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{entrega.respuestaTexto}</p>
                </div>
              )}
              <label htmlFor="entrega-nota">Calificación de la entrega</label><p>Escala 0–{entrega.escalaMaxima ?? 100}</p>
              <input
                id="entrega-nota"
                required
                type="number"
                min={0}
                max={entrega.escalaMaxima ?? 100}
                step={entrega.escalaMaxima === 10 ? 'any' : '0.01'}
                value={nota}
                onChange={(e) => setNota(e.target.value)}
              />
              <label htmlFor="entrega-comentario">Retroalimentación</label>
              <textarea
                id="entrega-comentario"
                maxLength={500}
                value={comentario}
                onChange={(e) => setComentario(e.target.value)}
              />
              <button disabled={enviando}>Guardar calificación de entrega</button>
            </form>
          )}
        </>
      )}
    </>
  );
}
