import { FormEvent, useEffect, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { api, mensajeDeError } from '../api/client';
import { ResumenCartera, type ResumenFinancieroCartera } from '../components/ResumenCartera';
import { SelectorBuscable } from '../components/SelectorBuscable';
import { useConfirmacion } from '../components/useConfirmacion';
import { estadoApertura, montoMXN } from './cartera-presentacion';
interface Detalle {
  id: number;
  alumnoId: number;
  matricula: string | null;
  nombreAlumno: string | null;
  estado: string;
  total: number;
  grupoId: number | null;
  contexto: Record<string, string | number> | null;
  financiero: ResumenFinancieroCartera;
}
/** Vista independiente: el calendario y la reanudación no se insertan dentro de una celda. */
export function DetalleApertura() {
  const { id } = useParams(),
    [query] = useSearchParams();
  const [datos, setDatos] = useState<Detalle | null>(null),
    [error, setError] = useState(''),
    [cargando, setCargando] = useState(true),
    [ocupado, setOcupado] = useState(false),
    [grupoId, setGrupoId] = useState(''),
    [motivo, setMotivo] = useState(''),
    [mensaje, setMensaje] = useState(''),
    [intento, setIntento] = useState(0);
  const titulo = useRef<HTMLHeadingElement>(null),
    bloqueo = useRef(false),
    confirmacion = useConfirmacion();
  const volver = new URLSearchParams(query);
  volver.set('vista', 'consulta');
  useEffect(() => {
    titulo.current?.focus();
  }, [id]);
  useEffect(() => {
    let vigente = true;
    setCargando(true);
    setDatos(null);
    setError('');
    setGrupoId('');
    setMotivo('');
    setMensaje('');
    if (!/^\d+$/.test(id || '') || Number(id) < 1) {
      setError('Apertura no válida');
      setCargando(false);
      return;
    }
    api
      .get<Detalle>(`/cartera/${id}`)
      .then((r) => {
        if (vigente) setDatos(r.data);
      })
      .catch((e) => {
        if (vigente) setError(mensajeDeError(e));
      })
      .finally(() => {
        if (vigente) setCargando(false);
      });
    return () => {
      vigente = false;
    };
  }, [id, intento]);
  const reanudar = async (e: FormEvent) => {
    e.preventDefault();
    if (bloqueo.current || !datos) return;
    bloqueo.current = true;
    const aceptado = await confirmacion.solicitar({
      titulo: 'Reanudar cartera',
      descripcion: `Apertura #${id}. Se conservarán las cuotas y tarifas acordadas. Si se asigna un grupo, se generarán los cargos correspondientes una sola vez.`,
      etiqueta: 'Reanudar cartera',
    });
    if (!aceptado) {
      bloqueo.current = false;
      return;
    }
    setOcupado(true);
    setError('');
    setMensaje('');
    try {
      const r = await api.post(`/cartera/${id}/reanudar`, {
        ...(grupoId ? { grupoId: Number(grupoId) } : {}),
        motivo,
        confirmado: true,
      });
      // Conservar el resultado de la escritura aunque falle la consulta posterior.
      setDatos((d) => (d ? { ...d, estado: r.data.estado, grupoId: r.data.grupoId } : d));
      setMensaje(
        r.data.estado === 'PAUSA'
          ? 'Continúa en pausa sin cargos: no se encontró grupo disponible.'
          : 'Cartera reanudada y grupo asignado.',
      );
      setDatos((await api.get<Detalle>(`/cartera/${id}`)).data);
    } catch (e) {
      setError(mensajeDeError(e));
    } finally {
      setOcupado(false);
      bloqueo.current = false;
    }
  };
  return (
    <main className="contenido edicion-enfocada detalle-cartera">
      {confirmacion.elemento}
      <h1 ref={titulo} tabIndex={-1}>
        Detalle de apertura #{id}
      </h1>
      <Link to={'/apertura-cartera?' + volver.toString()}>Volver a aperturas</Link>
      {cargando && <p role="status">Consultando cuotas y pagos…</p>}
      {error && (
        <p role="alert">
          {error}{' '}
          <button disabled={ocupado} onClick={() => setIntento((v) => v + 1)}>
            Reintentar consulta
          </button>
        </p>
      )}
      {mensaje && <p role="status">{mensaje}</p>}
      {datos && (
        <>
          <section className="panel" aria-label="Datos de la apertura">
            <h2>{datos.nombreAlumno || `Alumno ${datos.alumnoId}`}</h2>
            <p>
              {datos.matricula || 'Sin matrícula disponible'} · {estadoApertura(datos.estado).titulo}
            </p>
            <p>{estadoApertura(datos.estado).descripcion}</p>
            <p>
              Total contratado: <strong>{montoMXN(datos.total)}</strong> ·{' '}
              {datos.grupoId ? `Grupo ${datos.grupoId}` : 'Sin grupo asignado'}
            </p>
          </section>
          <ResumenCartera datos={datos.financiero} />
          {datos.estado === 'PAUSA' && datos.contexto && (
            <form className="panel formulario-cartera" onSubmit={reanudar}>
              <fieldset disabled={ocupado}>
                <legend>Reanudar cartera</legend>
                <p>
                  Selecciona un grupo o deja la asignación automática. Si no hay grupo, seguirá en pausa sin cargos.
                </p>
                <SelectorBuscable<{ id: number; nombre: string }>
                  ruta="/academico/grupos"
                  etiqueta="Grupo para reanudar cartera (opcional)"
                  requerido={false}
                  valor={grupoId}
                  cambiar={setGrupoId}
                  filtros={datos.contexto}
                  texto={(g) => g.nombre}
                />
                <div className="campo">
                  <label htmlFor="reanudar-motivo">Motivo de reanudación</label>
                  <input
                    id="reanudar-motivo"
                    required
                    minLength={10}
                    maxLength={500}
                    value={motivo}
                    onChange={(e) => setMotivo(e.target.value)}
                  />
                </div>
                <div className="acciones-formulario">
                  <button className="boton" disabled={ocupado}>
                    {ocupado ? 'Reanudando…' : 'Revisar reanudación'}
                  </button>
                </div>
              </fieldset>
            </form>
          )}
        </>
      )}
    </main>
  );
}
