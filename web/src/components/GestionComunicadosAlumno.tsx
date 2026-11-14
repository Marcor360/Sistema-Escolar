import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { api, mensajeDeError } from '../api/client';
import { useConfirmacion } from './useConfirmacion';

type Plantel = { id: number; nombre: string };
type Comunicado = {
  id: number; plantelId: number; titulo: string; mensaje: string;
  estado: 'BORRADOR' | 'ENVIADO'; destinatarios: number; enviadoEn: string | null;
};
type Listado = { datos: Comunicado[]; total: number; pagina: number; porPagina: number };
const vacio = { titulo: '', mensaje: '' };

export function GestionComunicadosAlumno() {
  const confirmacion = useConfirmacion();
  const consultaActual = useRef(0);
  const [revision, setRevision] = useState(0);
  const [errorConsulta, setErrorConsulta] = useState('');
  const [planteles, setPlanteles] = useState<Plantel[]>([]);
  const [plantelId, setPlantelId] = useState('');
  const [datos, setDatos] = useState(vacio);
  const [editando, setEditando] = useState<number | null>(null);
  const [pagina, setPagina] = useState(1);
  const [listado, setListado] = useState<Listado | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [exito, setExito] = useState('');

  const cargar = useCallback(async () => {
    const solicitud = ++consultaActual.current;
    const [{ data: sedes }, { data: lista }] = await Promise.all([
      api.get<Plantel[]>('/planteles/mios'),
      api.get<Listado>('/notificaciones/comunicados', { params: { pagina, porPagina: 10 } }),
    ]);
    if (solicitud !== consultaActual.current) return;
    setPlanteles(sedes);
    setListado(lista);
    setPlantelId((actual) => actual || String(sedes[0]?.id || ''));
  }, [pagina]);

  useEffect(() => {
    let vigente = true;
    setCargando(true);
    setErrorConsulta('');
    void cargar().catch((fallo: unknown) => { if (vigente) setErrorConsulta(mensajeDeError(fallo)); })
      .finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; consultaActual.current += 1; };
  }, [cargar, revision]);

  const guardar = async (evento: FormEvent) => {
    evento.preventDefault();
    if (ocupado) return;
    setOcupado(true); setError(''); setExito('');
    try {
      if (editando !== null) await api.patch(`/notificaciones/comunicados/${editando}`, datos);
      else await api.post('/notificaciones/comunicados', { ...datos, plantelId: Number(plantelId) });
      await cargar();
      setDatos(vacio); setEditando(null);
      setExito('Borrador guardado. No se ha enviado ninguna notificación.');
    } catch (fallo) { setError(mensajeDeError(fallo)); }
    finally { setOcupado(false); }
  };

  const publicar = async (id: number) => {
    if (ocupado) return;
    setOcupado(true); setError(''); setExito('');
    try {
      const { data } = await api.post<{ destinatarios: number; excedeLimite: boolean }>(`/notificaciones/comunicados/${id}/preview`);
      if (data.excedeLimite || data.destinatarios === 0) {
        setError(data.excedeLimite ? 'La campaña supera 500 alumnos. Divide la audiencia antes de enviar.' : 'El plantel no tiene alumnos activos destinatarios.');
        return;
      }
      if (!await confirmacion.solicitar({
        titulo: 'Publicar comunicado a alumnos',
        descripcion: `Se publicará este comunicado para ${data.destinatarios} alumnos activos. Revisa el contenido y el plantel antes de continuar; la publicación no puede deshacerse.`,
        riesgo: 'alto',
        etiqueta: 'Publicar comunicado',
      })) return;
      const respuesta = await api.post<{ enviadas: number; repetido: boolean }>(`/notificaciones/comunicados/${id}/publicar`);
      setExito(respuesta.data.repetido ? 'Este comunicado ya había sido publicado; no se duplicó.' : `Comunicado publicado a ${respuesta.data.enviadas} alumnos.`);
      await cargar();
    } catch (fallo) { setError(mensajeDeError(fallo)); }
    finally { setOcupado(false); }
  };

  const editar = (comunicado: Comunicado) => {
    setEditando(comunicado.id);
    setPlantelId(String(comunicado.plantelId));
    setDatos({ titulo: comunicado.titulo, mensaje: comunicado.mensaje });
    setError(''); setExito('');
  };

  return <section className="panel" aria-labelledby="comunicados-alumnos-titulo">
    {confirmacion.elemento}
    <h2 id="comunicados-alumnos-titulo">Comunicados gestionados para alumnos</h2>
    <p className="detalle">Prepara mensajes por plantel y publícalos después de revisar el número de alumnos. El historial enviado se conserva y no se modifica.</p>
    <form onSubmit={(evento) => void guardar(evento)} aria-busy={ocupado}>
      <div className="campo"><label htmlFor="comunicado-plantel">Plantel destinatario</label>
        <select id="comunicado-plantel" value={plantelId} onChange={(evento) => setPlantelId(evento.target.value)} disabled={ocupado || editando !== null} required>
          <option value="">Selecciona un plantel</option>
          {planteles.map((plantel) => <option key={plantel.id} value={plantel.id}>{plantel.nombre}</option>)}
        </select>
      </div>
      <div className="campo"><label htmlFor="comunicado-titulo">Título</label><input id="comunicado-titulo" value={datos.titulo} minLength={1} maxLength={150} required onChange={(evento) => setDatos({ ...datos, titulo: evento.target.value })} /></div>
      <div className="campo"><label htmlFor="comunicado-mensaje">Mensaje</label><textarea id="comunicado-mensaje" value={datos.mensaje} minLength={1} maxLength={600} required rows={4} onChange={(evento) => setDatos({ ...datos, mensaje: evento.target.value })} /></div>
      <div className="fila"><button className="boton" disabled={ocupado || !plantelId} type="submit">{ocupado ? 'Guardando…' : editando !== null ? 'Actualizar borrador' : 'Guardar borrador'}</button>
        {editando !== null && <button className="boton secundario" type="button" onClick={() => { setEditando(null); setDatos(vacio); }}>Cancelar edición</button>}</div>
    </form>
    {error && <p role="alert" className="mensaje-error">{error}</p>}
    {errorConsulta && <p role="alert" className="mensaje-error">No se pudieron consultar los comunicados: {errorConsulta}</p>}
    {exito && <p role="status" className="mensaje-ok">{exito}</p>}
    <h3>Historial y borradores</h3>
    {cargando ? <p role="status">Cargando comunicados…</p>
      : errorConsulta ? <button type="button" className="boton secundario" onClick={() => setRevision((v) => v + 1)}>Reintentar consulta</button>
      : !listado?.datos.length ? <p>No hay comunicados en los planteles autorizados.</p>
      : <ul>{listado.datos.map((comunicado) => <li key={comunicado.id}>
        <strong>{comunicado.titulo}</strong> · {comunicado.estado === 'ENVIADO' ? `Publicado a ${comunicado.destinatarios} alumnos` : 'Borrador'} · {planteles.find((plantel) => plantel.id === comunicado.plantelId)?.nombre ?? 'Plantel autorizado'}
        <p>{comunicado.mensaje}</p>
        {comunicado.estado === 'BORRADOR' && <div className="fila">
          <button className="boton secundario" type="button" disabled={ocupado} onClick={() => editar(comunicado)}>Editar</button>
          <button className="boton" type="button" disabled={ocupado} onClick={() => void publicar(comunicado.id)}>Revisar y publicar</button>
        </div>}
      </li>)}</ul>}
    <div className="fila">
      <button type="button" className="boton secundario" disabled={pagina <= 1 || ocupado || cargando || !!errorConsulta} onClick={() => setPagina((actual) => actual - 1)}>Anterior</button>
      <span>Página {pagina}</span>
      <button type="button" className="boton secundario" disabled={ocupado || cargando || !!errorConsulta || (listado?.total ?? 0) <= pagina * 10} onClick={() => setPagina((actual) => actual + 1)}>Siguiente</button>
    </div>
  </section>;
}
