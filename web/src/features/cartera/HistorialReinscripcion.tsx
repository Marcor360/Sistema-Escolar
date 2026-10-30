import type { Resultado } from './tipos-reinscripcion';
import { pesos } from '../../utils/formato';
export function HistorialReinscripcion({
  historial,
  ocupado,
  puedeConfirmar,
  motivoAnular,
  cambiarMotivo,
  cargar,
  anular,
}: {
  historial: Resultado[];
  ocupado: boolean;
  puedeConfirmar: boolean;
  motivoAnular: string;
  cambiarMotivo: (v: string) => void;
  cargar: () => Promise<void>;
  anular: (id: number) => Promise<void>;
}) {
  return (
    <section className="panel">
      <h2>Historial de reinscripciones</h2>
      <button disabled={ocupado} onClick={() => void cargar()}>
        Consultar historial de reinscripciones
      </button>
      {puedeConfirmar && (
        <label>
          Motivo para anular una solicitud pendiente
          <input minLength={10} maxLength={300} value={motivoAnular} onChange={(e) => cambiarMotivo(e.target.value)} />
        </label>
      )}
      {historial.map((r) => (
        <article key={r.id}>
          <h3>
            Operación #{r.id} · {r.estado}
          </h3>
          <p>
            Origen #{r.origenInscripcionId} → periodo #{r.periodoAcademicoId} ·{' '}
            {r.grupoId ? `grupo #${r.grupoId}` : 'sin grupo asignado'} · {pesos(r.total)}
          </p>
          {puedeConfirmar && ['PENDIENTE', 'REQUIERE_REVISION'].includes(r.estado) && (
            <button disabled={ocupado || motivoAnular.trim().length < 10} onClick={() => void anular(r.id)}>
              Anular solicitud #{r.id}
            </button>
          )}
        </article>
      ))}
    </section>
  );
}
