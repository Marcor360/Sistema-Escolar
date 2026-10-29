import type { Cotizacion } from './tipos-reinscripcion';
import { pesos } from '../../utils/formato';
interface Props {
  origen: string;
  ciclo?: string;
  ocupado: boolean;
  puedeAjustar: boolean;
  autorizar: () => void;
  cotizacion: Cotizacion;
}
export function ConfirmacionReinscripcion({ origen, ciclo, ocupado, puedeAjustar, autorizar, cotizacion }: Props) {
  return (
    <div aria-live="polite">
      <h2>Confirmar nuevo periodo</h2>
      <p>
        {origen} → periodo seleccionado · {ciclo}
      </p>
      {cotizacion.conceptos.map((c, i) => (
        <p key={`${c.conceptoId}:${i}`}>
          {c.nombre}: {pesos(c.monto)}
        </p>
      ))}
      <p>
        <strong>Total: {pesos(cotizacion.total)}</strong>
      </p>
      <p>
        Confirmar crea una nueva solicitud y cargos solo si corresponde; no implica aprobación de materias reprobadas ni
        pago registrado.
      </p>
      {puedeAjustar && (
        <button className="boton" type="button" disabled={ocupado} onClick={autorizar}>
          Autorizar precio y calendario como Finanzas
        </button>
      )}
    </div>
  );
}
