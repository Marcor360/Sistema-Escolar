import type { RefObject } from 'react';
import { montoMXN } from '../../pages/cartera-presentacion';
interface Props {
  tituloRef: RefObject<HTMLHeadingElement>;
  nuevo: boolean;
  pausa: boolean;
  ocupada: boolean;
  cotizacion: {
    total: number;
    conceptos: { nombre: string; periodo: string; fechaVencimiento: string; monto: number }[];
  };
  confirmar: () => void;
}
export function ConfirmacionApertura({ tituloRef, nuevo, pausa, ocupada, cotizacion, confirmar }: Props) {
  return (
    <section aria-label="Previsualización" className="cartera-resumen">
      <h2 ref={tituloRef} tabIndex={-1}>
        Revisar y confirmar apertura
      </h2>
      <p>
        {nuevo
          ? 'Se creará el alumno sin correo institucional y su cartera.'
          : 'Se asignará la cartera al expediente seleccionado.'}
      </p>
      {cotizacion.conceptos.map((c, i) => (
        <p key={i}>
          {c.nombre} · {c.periodo} · Vence {c.fechaVencimiento}: {montoMXN(c.monto)}
        </p>
      ))}
      <p>
        Total contratado: <strong>{montoMXN(cotizacion.total)}</strong>
      </p>
      <p>
        {pausa
          ? 'Quedará en pausa sin cargos.'
          : 'Los cargos se generarán únicamente si se asigna grupo; de lo contrario quedará en pausa.'}
      </p>
      <button type="button" className="boton" disabled={ocupada} onClick={confirmar}>
        {ocupada ? 'Confirmando…' : 'Confirmar alumno y cartera'}
      </button>
    </section>
  );
}
