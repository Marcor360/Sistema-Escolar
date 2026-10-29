import { montoMXN } from '../../pages/cartera-presentacion';
export interface CuotaApertura {
  conceptoId: string;
  periodo: string;
  fechaVencimiento: string;
  monto: string;
}
interface Tarifa {
  id: number;
  clave: string;
  nombre: string;
  montoBase: number;
}
interface Props {
  total: string;
  cambiarTotal: (v: string) => void;
  puedeAjustar: boolean;
  cuotas: CuotaApertura[];
  tarifas: Tarifa[];
  modificarCuota: (i: number, cambio: Partial<CuotaApertura>) => void;
  agregar: () => void;
  quitar: (i: number) => void;
  suma: number;
  coincide: boolean;
}
export function CalendarioApertura({
  total,
  cambiarTotal,
  puedeAjustar,
  cuotas,
  tarifas,
  modificarCuota,
  agregar,
  quitar,
  suma,
  coincide,
}: Props) {
  return (
    <fieldset>
      <legend>Total y calendario de colegiaturas</legend>
      <div className="campo">
        <label htmlFor="cartera-total">Total contratado del periodo</label>
        <input
          id="cartera-total"
          required
          type="number"
          min="0.01"
          max="9999999999.99"
          step="0.01"
          value={total}
          onChange={(e) => cambiarTotal(e.target.value)}
        />
      </div>
      <p>
        Distribuye el total entre las cuotas. Se generarán esas cuotas una sola vez; no se añadirá un cargo por el
        total.
      </p>
      {!puedeAjustar && (
        <p>Se utilizan las tarifas de catálogo. Los importes personalizados requieren autorización de Finanzas.</p>
      )}
      {cuotas.map((c, i) => (
        <fieldset key={i} className="cartera-cuota">
          <legend>Cuota {i + 1}</legend>
          <div className="cartera-cuota-grid">
            <div className="campo">
              <label htmlFor={`cuota-concepto-${i}`}>Concepto</label>
              <select
                id={`cuota-concepto-${i}`}
                required
                value={c.conceptoId}
                onChange={(e) =>
                  modificarCuota(i, {
                    conceptoId: e.target.value,
                    monto: String(tarifas.find((t) => String(t.id) === e.target.value)?.montoBase ?? ''),
                  })
                }
              >
                <option value="">Selecciona…</option>
                {tarifas.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.clave} · {t.nombre} · {montoMXN(t.montoBase)}
                  </option>
                ))}
              </select>
            </div>
            <div className="campo">
              <label htmlFor={`cuota-mes-${i}`}>Mes de cobro</label>
              <input
                id={`cuota-mes-${i}`}
                type="month"
                required
                value={c.periodo}
                onChange={(e) => modificarCuota(i, { periodo: e.target.value })}
              />
            </div>
            <div className="campo">
              <label htmlFor={`cuota-vencimiento-${i}`}>Fecha de vencimiento</label>
              <input
                id={`cuota-vencimiento-${i}`}
                type="date"
                required
                value={c.fechaVencimiento}
                onChange={(e) => modificarCuota(i, { fechaVencimiento: e.target.value })}
              />
            </div>
            <div className="campo">
              <label htmlFor={`cuota-monto-${i}`}>Importe</label>
              <input
                id={`cuota-monto-${i}`}
                type="number"
                min="0.01"
                max="9999999999.99"
                step="0.01"
                required
                readOnly={!puedeAjustar}
                value={c.monto}
                onChange={(e) => modificarCuota(i, { monto: e.target.value })}
              />
            </div>
          </div>
          {cuotas.length > 1 && (
            <button type="button" onClick={() => quitar(i)}>
              Quitar cuota {i + 1}
            </button>
          )}
        </fieldset>
      ))}
      <button type="button" disabled={cuotas.length >= 60} onClick={() => agregar()}>
        Agregar cuota
      </button>
      <p aria-live="polite">
        Suma de cuotas: {montoMXN(suma / 100)} · Total contratado: {montoMXN(Number(total || 0))}
      </p>
      {!coincide && !!total && <p>La suma de cuotas debe coincidir con el total contratado.</p>}
    </fieldset>
  );
}
