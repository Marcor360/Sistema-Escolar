import type { Autorizacion } from './tipos-reinscripcion';
import { pesos } from '../../utils/formato';
export function AutorizacionesReinscripcion({
  autorizaciones,
  autorizacion,
  ocupado,
  puedeConfirmar,
  seleccionar,
  actualizar,
  confirmar,
}: {
  autorizaciones: Autorizacion[];
  autorizacion: Autorizacion | null;
  ocupado: boolean;
  puedeConfirmar: boolean;
  seleccionar: (a: Autorizacion) => void;
  actualizar: () => Promise<void>;
  confirmar: () => Promise<void>;
}) {
  return (
    <section className="panel">
      <h2>4. Autorizaciones financieras vigentes</h2>
      <p>
        Control Escolar confirma una cotización ya autorizada por Finanzas. El contenido guardado en servidor se
        verifica nuevamente antes de asignar grupo y cargos.
      </p>
      <button disabled={ocupado} onClick={() => void actualizar()}>
        Actualizar autorizaciones
      </button>
      {!autorizaciones.length && <p>No hay autorizaciones vigentes para este alumno.</p>}
      {autorizaciones.map((a) => (
        <label key={a.id}>
          <input
            type="radio"
            name="autorizacion"
            checked={autorizacion?.id === a.id}
            disabled={ocupado}
            onChange={() => seleccionar(a)}
          />
          Autorización #{a.id} · {pesos(a.total)} · Finanzas #{a.financieroId} · vence{' '}
          {new Date(a.venceAt).toLocaleString('es-MX')}
        </label>
      ))}
      {autorizacion && (
        <>
          <h3>Cotización autorizada #{autorizacion.id}</h3>
          <p>
            Destino autorizado: {autorizacion.destino.periodo} · {autorizacion.destino.tipo}{' '}
            {autorizacion.destino.numero} · {autorizacion.destino.ciclo} ·{' '}
            {autorizacion.destino.grupoId ? `Grupo #${autorizacion.destino.grupoId}` : 'Asignación automática'}. Se
            confirma esta autorización, conservando su total y calendario.
          </p>
          {autorizacion.conceptos.map((c, i) => (
            <p key={i}>
              {c.nombre}: {pesos(c.monto)}
              {c.descuento ? ` · descuento ${pesos(c.descuento)}` : ''}
            </p>
          ))}
          <p>Total {pesos(autorizacion.total)}. No incluye pagos registrados.</p>
          {puedeConfirmar && (
            <button disabled={ocupado} onClick={() => void confirmar()}>
              Confirmar reinscripción y cargos
            </button>
          )}
        </>
      )}
    </section>
  );
}
