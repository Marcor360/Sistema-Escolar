import { useRef, useState } from 'react';
import { api, mensajeDeError } from '../api/client';
import { useConfirmacion } from './useConfirmacion';
export interface Atencion {
  estado: string;
  vigente: boolean;
  eventos: {
    id: number;
    estado: string;
    responsableId: number;
    responsable: string;
    actor: string;
    comentario: string;
    fecha: string;
  }[];
}
export interface EventoAtencion {
  id: number;
  respuestaId: number;
  estado: string;
  responsable: string;
  actor: string;
  comentario: string;
  fecha: string;
}
export const nombreAtencion = (estado: string) =>
  ({ PENDIENTE: 'Pendiente', EN_ATENCION: 'En atención', RESUELTA: 'Resuelta' })[estado] ?? estado;
export function AtencionBoleta({
  inscripcionId,
  revisionId,
  versionHash,
  responsables,
  atencion,
  alGuardar,
}: {
  inscripcionId: number;
  revisionId: number;
  versionHash: string;
  responsables: { id: number; nombre: string }[];
  atencion: Atencion | null;
  alGuardar: () => void;
}) {
  const [estado, setEstado] = useState(
    atencion?.estado === 'RESUELTA' ? 'EN_ATENCION' : atencion?.estado === 'EN_ATENCION' ? 'RESUELTA' : 'EN_ATENCION',
  );
  const [responsable, setResponsable] = useState(String(atencion?.eventos[0]?.responsableId ?? ''));
  const [comentario, setComentario] = useState(''),
    [error, setError] = useState(''),
    [ocupado, setOcupado] = useState(false);
  const intento = useRef({ huella: '', clave: '' }),
    bloqueo = useRef(false),
    confirmar = useConfirmacion();
  return (
    <section className="panel">
      <h4>Atender solicitud de revisión</h4>
      {confirmar.elemento}
      <p>
        Estado actual: <strong>{nombreAtencion(atencion?.estado ?? 'PENDIENTE')}</strong>. El cierre conserva la
        solicitud; no modifica notas ni acepta la boleta por la familia.
      </p>
      {error && <p role="alert">{error}</p>}
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (bloqueo.current) return;
          bloqueo.current = true;
          setError('');
          try {
            if (
              !(await confirmar.solicitar({
                titulo: 'Registrar atención',
                descripcion: `Se guardará la revisión como ${nombreAtencion(estado).toLowerCase()} y el alumno verá tu respuesta.`,
              }))
            )
              return;
            setOcupado(true);
            const body = {
                respuestaId: revisionId,
                versionHash,
                responsableId: Number(responsable),
                estado,
                comentario: comentario.trim(),
              },
              huella = JSON.stringify(body);
            if (intento.current.huella !== huella) intento.current = { huella, clave: crypto.randomUUID() };
            await api.post(`/boletas/inscripciones/${inscripcionId}/atencion`, {
              ...body,
              idempotencia: intento.current.clave,
            });
            alGuardar();
          } catch (err) {
            setError(mensajeDeError(err));
          } finally {
            setOcupado(false);
            bloqueo.current = false;
          }
        }}
      >
        <fieldset disabled={ocupado}>
          <legend>Responsable y respuesta para la familia</legend>
          <div className="contexto-academico-grid">
            <div className="campo">
              <label htmlFor="revision-responsable">Responsable</label>
              <select
                id="revision-responsable"
                required
                value={responsable}
                onChange={(e) => setResponsable(e.target.value)}
              >
                <option value="">Seleccionar responsable</option>
                {responsables.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div className="campo">
              <label htmlFor="revision-estado">Estado de atención</label>
              <select id="revision-estado" required value={estado} onChange={(e) => setEstado(e.target.value)}>
                <option value="EN_ATENCION">En atención</option>
                {atencion?.estado === 'EN_ATENCION' && <option value="RESUELTA">Resuelta</option>}
                <option value="PENDIENTE" disabled={atencion?.estado === 'RESUELTA'}>
                  Pendiente
                </option>
              </select>
            </div>
          </div>
          <div className="campo">
            <label htmlFor="revision-respuesta">Respuesta o motivo del cambio</label>
            <textarea
              id="revision-respuesta"
              required
              maxLength={2000}
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
              rows={4}
            />
            <small>{comentario.length}/2000 caracteres. Visible para la familia.</small>
          </div>
          <button type="submit" disabled={ocupado || !responsable || !comentario.trim()}>
            {ocupado ? 'Guardando atención…' : 'Guardar atención'}
          </button>
        </fieldset>
      </form>
    </section>
  );
}
