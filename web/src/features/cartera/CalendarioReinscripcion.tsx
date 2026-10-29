export interface CuotaReinscripcion {
  periodo: string;
  fechaVencimiento: string;
  monto: string;
  descuento: string;
}
interface Props {
  cuotas: CuotaReinscripcion[];
  modificar: (i: number, cambio: Partial<CuotaReinscripcion>) => void;
  agregar: () => void;
  quitar: (i: number) => void;
}
export function CalendarioReinscripcion({ cuotas, modificar, agregar, quitar }: Props) {
  return (
    <section>
      <h2>Calendario y beca/descuento del periodo</h2>
      <p>Las cuotas deben sumar exactamente el total autorizado. El descuento de cada cuota se aplica una sola vez.</p>
      {cuotas.map((q, i) => (
        <fieldset key={i} className="cartera-cuota">
          <legend>Cuota {i + 1}</legend>
          <div className="cartera-cuota-grid">
            <label>
              Mes de cuota {i + 1}
              <input
                type="month"
                required
                value={q.periodo}
                onChange={(e) => modificar(i, { periodo: e.target.value })}
              />
            </label>
            <label>
              Vencimiento de cuota {i + 1}
              <input
                type="date"
                required
                value={q.fechaVencimiento}
                onChange={(e) => modificar(i, { fechaVencimiento: e.target.value })}
              />
            </label>
            <label>
              Importe de cuota {i + 1}
              <input
                type="number"
                min="0.01"
                step="0.01"
                required
                value={q.monto}
                onChange={(e) => modificar(i, { monto: e.target.value })}
              />
            </label>
            <label>
              Beca/descuento de cuota {i + 1}
              <input
                type="number"
                min="0"
                step="0.01"
                value={q.descuento}
                onChange={(e) => modificar(i, { descuento: e.target.value })}
              />
            </label>
          </div>
          <button type="button" onClick={() => quitar(i)}>
            Quitar cuota {i + 1}
          </button>
        </fieldset>
      ))}
      <button type="button" onClick={() => agregar()}>
        Añadir cuota
      </button>
    </section>
  );
}
