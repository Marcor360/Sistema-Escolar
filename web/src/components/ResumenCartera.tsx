import { montoMXN } from '../pages/cartera-presentacion';
export interface ResumenFinancieroCartera {
  aperturas: {
    id: number;
    estado: string;
    total: number;
    cuotas: { nombre: string; periodo: string; fechaVencimiento: string; monto: number; cargoId?: number }[];
  }[];
  cargos: {
    id: number;
    concepto: string;
    periodo: string | null;
    fechaVencimiento: string | null;
    pagado: number;
    saldo: number;
    estado: string;
  }[];
  pagado: number;
  saldo: number;
}
const estados: Record<string, string> = {
  PENDIENTE: 'Pendiente',
  ABIERTA: 'Abierta',
  PAUSA: 'En pausa',
  PAGADO: 'Pagado',
  PARCIAL: 'Pago parcial',
  VENCIDO: 'Vencido',
  CANCELADO: 'Cancelado',
};
export function ResumenCartera({ datos }: { datos: ResumenFinancieroCartera }) {
  return (
    <section className="resumen-cartera" aria-label="Cartera y pagos registrados">
      <h3>Cartera y pagos registrados</h3>
      <dl className="resumen-cartera-totales">
        <div>
          <dt>Pagos confirmados aplicados</dt>
          <dd>{montoMXN(datos.pagado)}</dd>
        </div>
        <div>
          <dt>Saldo de cargos</dt>
          <dd>{montoMXN(datos.saldo)}</dd>
        </div>
      </dl>
      {datos.aperturas.map((a) => (
        <details key={a.id}>
          <summary>
            <strong>Cartera #{a.id}</strong> · {estados[a.estado] ?? a.estado} · Total contratado: {montoMXN(a.total)}
          </summary>
          <ul aria-label={`Cuotas de la cartera ${a.id}`}>
            {a.cuotas.map((q, i) => (
              <li className="resumen-cargo" key={i}>
                <div>
                  <strong>{q.nombre}</strong>
                  <small>
                    {q.periodo} · Vence {q.fechaVencimiento}
                  </small>
                </div>
                <div className="importe">
                  <strong>{montoMXN(q.monto)}</strong>
                  <small>{q.cargoId ? 'Cargo registrado' : 'Sin cargo generado'}</small>
                </div>
              </li>
            ))}
          </ul>
        </details>
      ))}
      {datos.cargos.length > 0 ? (
        <ul aria-label="Cargos y pagos aplicados">
          {datos.cargos.map((c) => (
            <li className="resumen-cargo" key={c.id}>
              <div>
                <strong>{c.concepto}</strong>
                <small>
                  {c.periodo ?? 'Sin mes asignado'} · {estados[c.estado] ?? c.estado}
                </small>
              </div>
              <div className="importe">
                <small>Pagado</small>
                <strong>{montoMXN(c.pagado)}</strong>
              </div>
              <div className="importe">
                <small>Pendiente</small>
                <strong>{montoMXN(c.saldo)}</strong>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p>No hay cargos generados en este plantel.</p>
      )}
    </section>
  );
}
