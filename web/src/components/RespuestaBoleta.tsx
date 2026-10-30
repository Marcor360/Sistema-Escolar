import { AtencionBoleta, nombreAtencion, type Atencion, type EventoAtencion } from './AtencionBoleta';
import { FormEvent, useEffect, useRef, useState } from 'react';
import { api, mensajeDeError } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { useConfirmacion } from './useConfirmacion';
export interface SeguimientoBoleta {
  revisionId?: number | null;
  puedeGestionar?: boolean;
  responsables?: { id: number; nombre: string }[];
  atencion?: Atencion | null;
  historialAtenciones?: EventoAtencion[];
  inscripcionId: number;
  alumnoId?: number;
  alumno: string;
  matricula: string;
  disponible: boolean;
  versionHash: string;
  estado: string;
  materiasDocente?: { grupoMateriaId: number; asignatura: string }[];
  materias: { grupoMateriaId: number; asignatura: string; promedioFinal: number | null; observaciones: string }[];
  historial: {
    id: number;
    estado: string;
    comentario: string;
    firmanteNombre: string;
    firmanteTipo: string;
    asignatura: string | null;
    fecha: string;
    vigente: boolean;
  }[];
}
const estados: Record<string, string> = {
  ACEPTADA: 'Boleta aceptada',
  REVISION: 'Revisión con comentarios',
  PENDIENTE_RESPUESTA: 'Pendiente de aceptación',
  PENDIENTE_PUBLICACION: 'Pendiente de publicación',
  COMENTARIO: 'Comentario docente',
};
export function RespuestaBoleta({ inscripcionId }: { inscripcionId: number }) {
  const { sesion } = useAuth(),
    alumno = sesion?.roles.includes('ALUMNO'),
    docente = sesion?.roles.includes('MAESTRO');
  const [datos, setDatos] = useState<SeguimientoBoleta | null>(null),
    [error, setError] = useState(''),
    [intento, setIntento] = useState(0),
    [ocupado, setOcupado] = useState(false),
    [estado, setEstado] = useState('ACEPTADA'),
    [nombre, setNombre] = useState(''),
    [tipo, setTipo] = useState('ALUMNO'),
    [comentario, setComentario] = useState(''),
    [confirmado, setConfirmado] = useState(false),
    [materia, setMateria] = useState(''),
    [mensaje, setMensaje] = useState('');
  const versionAnterior = useRef<string | null>(null);
  const clave = useRef(crypto.randomUUID()),
    bloqueo = useRef(false),
    confirmar = useConfirmacion();
  useEffect(() => {
    let vigente = true;
    setDatos(null);
    setError('');
    setConfirmado(false);
    api
      .get<SeguimientoBoleta>(`/boletas/inscripciones/${inscripcionId}`)
      .then((r) => {
        if (vigente) {
          if (versionAnterior.current !== r.data.versionHash) {
            clave.current = crypto.randomUUID();
            versionAnterior.current = r.data.versionHash;
          }
          setDatos(r.data);
        }
      })
      .catch((e) => {
        if (vigente) setError(mensajeDeError(e));
      });
    return () => {
      vigente = false;
    };
  }, [inscripcionId, intento]);
  const guardar = async (e: FormEvent) => {
    e.preventDefault();
    if (bloqueo.current || !datos) return;
    bloqueo.current = true;
    if (
      !(await confirmar.solicitar(
        alumno
          ? '¿Registrar esta respuesta para las calificaciones que acabas de revisar?'
          : '¿Publicar este comentario en la materia seleccionada?',
      ))
    ) {
      bloqueo.current = false;
      return;
    }
    setOcupado(true);
    setError('');
    try {
      await api.post(
        `/boletas/inscripciones/${inscripcionId}/${alumno ? 'responder' : 'comentarios'}`,
        alumno
          ? {
              idempotencia: clave.current,
              versionHash: datos.versionHash,
              estado,
              firmanteNombre: nombre,
              firmanteTipo: tipo,
              comentario: estado === 'REVISION' ? comentario : '',
              confirmado,
            }
          : {
              idempotencia: clave.current,
              versionHash: datos.versionHash,
              grupoMateriaId: Number(materia),
              comentario,
            },
      );
      clave.current = crypto.randomUUID();
      setComentario('');
      setConfirmado(false);
      setMensaje('Respuesta registrada. Se conserva su fecha y versión.');
      setIntento((v) => v + 1);
    } catch (e) {
      setError(mensajeDeError(e));
    } finally {
      setOcupado(false);
      bloqueo.current = false;
    }
  };
  const descargarConstancia = async (respuestaId: number) => {
    if (ocupado) return;
    setOcupado(true);
    setError('');
    try {
      const r = await api.get(`/boletas/inscripciones/${inscripcionId}/constancias/${respuestaId}/pdf`, {
        responseType: 'blob',
      });
      const url = URL.createObjectURL(r.data),
        a = document.createElement('a');
      a.href = url;
      a.download = `constancia-boleta-${respuestaId}.pdf`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (e) {
      setError(mensajeDeError(e));
    } finally {
      setOcupado(false);
    }
  };
  const descargar = async () => {
    if (!datos?.alumnoId || ocupado) return;
    setOcupado(true);
    setError('');
    try {
      const r = await api.get(`/reportes/formatos/boleta/${datos.alumnoId}/pdf`, {
        params: { inscripcionId },
        responseType: 'blob',
      });
      const url = URL.createObjectURL(r.data),
        a = document.createElement('a');
      a.href = url;
      a.download = `boleta-${datos.matricula}.pdf`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (e) {
      setError(mensajeDeError(e));
    } finally {
      setOcupado(false);
    }
  };
  return (
    <section className="panel boleta-respuesta" aria-label="Aceptación y revisión de boleta">
      {confirmar.elemento}
      <h3>Aceptación y revisión de boleta</h3>
      {error && (
        <p role="alert">
          {error}
          <button onClick={() => setIntento((v) => v + 1)}>Actualizar boleta</button>
        </p>
      )}
      {mensaje && <p role="status">{mensaje}</p>}
      {!datos && !error && <p role="status">Consultando seguimiento…</p>}
      {datos && (
        <>
          <p>
            <strong>{estados[datos.estado] ?? datos.estado}</strong>
          </p>
          {datos.atencion && (
            <p>
              Atención de la revisión: <strong>{nombreAtencion(datos.atencion.estado)}</strong>
              {!datos.atencion.vigente && ' · corresponde a una respuesta anterior'}.
            </p>
          )}
          {datos.puedeGestionar && datos.revisionId && (
            <AtencionBoleta
              key={`${datos.revisionId}-${intento}`}
              inscripcionId={inscripcionId}
              revisionId={datos.revisionId}
              versionHash={datos.versionHash}
              responsables={datos.responsables ?? []}
              atencion={datos.atencion ?? null}
              alGuardar={() => {
                setMensaje('Atención registrada. La familia podrá consultar tu respuesta.');
                setIntento((v) => v + 1);
              }}
            />
          )}
          <h4>Calificaciones de la versión que vas a responder</h4>
          <div className="tabla-contenedor">
            <table className="tabla tabla-adaptable">
              <caption className="sr-only">Calificaciones de las materias autorizadas</caption>
              <thead>
                <tr>
                  <th scope="col">Materia</th>
                  <th scope="col">Calificación final</th>
                </tr>
              </thead>
              <tbody>
                {datos.materias.map((m) => (
                  <tr key={m.grupoMateriaId}>
                    <td data-etiqueta="Materia">
                      {m.asignatura}
                      {m.observaciones && <p>{m.observaciones}</p>}
                    </td>
                    <td data-etiqueta="Calificación final">{m.promedioFinal ?? 'Pendiente'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {datos.disponible &&
            sesion?.roles.some((r) => ['ADMINISTRATIVO', 'DIRECTOR', 'SUPERADMIN'].includes(r)) &&
            datos.alumnoId && (
              <button type="button" disabled={ocupado} onClick={() => void descargar()}>
                Descargar boleta PDF
              </button>
            )}
          {datos.disponible && (alumno || docente) && (
            <form onSubmit={guardar}>
              <fieldset disabled={ocupado}>
                <legend>{alumno ? 'Revisar y firmar con nombre completo' : 'Comentarios por materia'}</legend>
                {alumno ? (
                  <>
                    <div className="campo">
                      <label htmlFor={`respuesta-estado-${inscripcionId}`}>Respuesta</label>
                      <select
                        id={`respuesta-estado-${inscripcionId}`}
                        value={estado}
                        onChange={(e) => {
                          setEstado(e.target.value);
                          setConfirmado(false);
                          clave.current = crypto.randomUUID();
                        }}
                      >
                        <option value="ACEPTADA">Aceptar calificaciones</option>
                        <option value="REVISION">Revisión con comentarios</option>
                      </select>
                    </div>
                    <div className="campo">
                      <label htmlFor={`firmante-tipo-${inscripcionId}`}>Quién firma</label>
                      <select
                        id={`firmante-tipo-${inscripcionId}`}
                        value={tipo}
                        onChange={(e) => setTipo(e.target.value)}
                      >
                        <option value="ALUMNO">Alumno</option>
                        <option value="TUTOR">Padre, madre o tutor</option>
                      </select>
                    </div>
                    <div className="campo">
                      <label htmlFor={`firmante-nombre-${inscripcionId}`}>Nombre completo de quien firma</label>
                      <input
                        id={`firmante-nombre-${inscripcionId}`}
                        required
                        minLength={3}
                        maxLength={150}
                        value={nombre}
                        onChange={(e) => {
                          setNombre(e.target.value);
                          clave.current = crypto.randomUUID();
                        }}
                      />
                    </div>
                  </>
                ) : (
                  <div className="campo">
                    <label htmlFor={`materia-comentario-${inscripcionId}`}>Materia</label>
                    <select
                      id={`materia-comentario-${inscripcionId}`}
                      required
                      value={materia}
                      onChange={(e) => setMateria(e.target.value)}
                    >
                      <option value="">Selecciona tu materia</option>
                      {(datos.materiasDocente ?? datos.materias).map((m) => (
                        <option key={m.grupoMateriaId} value={m.grupoMateriaId}>
                          {m.asignatura}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                {(estado === 'REVISION' || !alumno) && (
                  <div className="campo">
                    <label htmlFor={`comentario-boleta-${inscripcionId}`}>Comentarios para revisión</label>
                    <textarea
                      id={`comentario-boleta-${inscripcionId}`}
                      required
                      maxLength={2000}
                      value={comentario}
                      onChange={(e) => {
                        setComentario(e.target.value);
                        clave.current = crypto.randomUUID();
                      }}
                    />
                    <small>{comentario.length}/2000 caracteres</small>
                  </div>
                )}
                {alumno && (
                  <label className="filtro-casilla">
                    <input
                      type="checkbox"
                      required
                      checked={confirmado}
                      onChange={(e) => setConfirmado(e.target.checked)}
                    />
                    He revisado esta boleta y confirmo mi nombre y la respuesta seleccionada.
                  </label>
                )}
                <button className="boton" disabled={ocupado}>
                  {ocupado ? 'Registrando…' : alumno ? 'Registrar firma y respuesta' : 'Publicar comentario de materia'}
                </button>
              </fieldset>
            </form>
          )}
          <h4>Historial y comentarios por materia</h4>
          {!!datos.historialAtenciones?.length && (
            <section aria-label="Historial de atención">
              <h4>Respuestas del personal escolar</h4>
              {datos.historialAtenciones.map((t) => (
                <article className="boleta-evento" key={t.id}>
                  <strong>{nombreAtencion(t.estado)}</strong>
                  <p>
                    Responsable: {t.responsable} · registrado por {t.actor}
                  </p>
                  <p>
                    {new Date(t.fecha).toLocaleString('es-MX', { timeZone: 'America/Mexico_City' })} · revisión #
                    {t.respuestaId}
                  </p>
                  <p className="boleta-comentario">{t.comentario}</p>
                </article>
              ))}
            </section>
          )}
          {!datos.historial.length && <p>Todavía no hay respuestas registradas.</p>}
          {datos.historial.map((h) => (
            <article className="boleta-evento" key={h.id}>
              <strong>
                {h.asignatura ? `${h.asignatura} · ` : ''}
                {estados[h.estado] ?? h.estado}
              </strong>
              <p>
                {h.firmanteNombre} ·{' '}
                {h.firmanteTipo === 'TUTOR'
                  ? 'Padre, madre o tutor'
                  : h.firmanteTipo === 'DOCENTE'
                    ? 'Docente'
                    : 'Alumno'}{' '}
                · {new Date(h.fecha).toLocaleString('es-MX', { timeZone: 'America/Mexico_City' })}
              </p>
              {!h.vigente && <p className="texto-ayuda">Corresponde a una versión anterior de las calificaciones.</p>}
              {h.comentario && <p className="boleta-comentario">{h.comentario}</p>}
              {h.estado === 'ACEPTADA' && (alumno || datos.puedeGestionar) && (
                <button type="button" disabled={ocupado} onClick={() => void descargarConstancia(h.id)}>
                  Descargar constancia de aceptación #{h.id}
                </button>
              )}
            </article>
          ))}
        </>
      )}
    </section>
  );
}
