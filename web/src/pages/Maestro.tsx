import { ActividadesClase } from '../features/maestro/ActividadesClase';
import { MaterialesClase } from '../features/maestro/MaterialesClase';
import { EntregasClase } from '../features/maestro/EntregasClase';
import type { GrupoMateria, Actividad, Material, Entrega } from '../features/maestro/tipos';
import { useConfirmacion } from '../components/useConfirmacion';
import { useDialogoMotivo } from '../components/useDialogoMotivo';
import { FormEvent, useRef, useState } from 'react';
import { api, mensajeDeError } from '../api/client';
import { Encabezado } from '../components/Encabezado';
import { useDatos } from '../hooks/useDatos';







const FORM_INICIAL = { titulo: '', descripcion: '', tipo: 'TAREA', parcial: '1', ponderacion: '0', fechaEntrega: '' };

export default function MaestroPage() {
  const confirmacion = useConfirmacion();
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
    <>{confirmacion.elemento}{dialogoMotivo.elemento}
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
        <ActividadesClase claseActiva={claseActiva} crearActividad={crearActividad} form={form} setForm={setForm} enviando={enviando} editandoActividad={editandoActividad} actividades={actividades} verEntregas={verEntregas} setEditandoActividad={setEditandoActividad} confirmacion={confirmacion} setEnviando={setEnviando} abrirClase={abrirClase} setError={setError} />
      )}

      {claseActiva && (
        <MaterialesClase claseActiva={claseActiva} subirMaterial={subirMaterial} tituloMaterial={tituloMaterial} setTituloMaterial={setTituloMaterial} archivoMaterial={archivoMaterial} enviando={enviando} materiales={materiales} dialogoMotivo={dialogoMotivo} abrirClase={abrirClase} confirmacion={confirmacion} setEnviando={setEnviando} setError={setError} />
      )}

      {entregas && actividadActiva && (
        <EntregasClase actividadActiva={actividadActiva} entregas={entregas} comentarios={comentarios} setComentarios={setComentarios} notas={notas} setNotas={setNotas} enviando={enviando} guardarNota={guardarNota} guardadas={guardadas} />
      )}
    </>
  );
}
