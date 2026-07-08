/** Formatos compartidos por las vistas financieras. */
export const pesos = (n: number) =>
  `$${n.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;

export type TonoSello = 'ok' | 'aviso' | 'mal' | 'neutro';

export const selloDeCargo = (estatus: string): TonoSello =>
  estatus === 'PAGADO' ? 'ok'
  : estatus === 'VENCIDO' ? 'mal'
  : estatus === 'PARCIAL' ? 'aviso'
  : 'neutro';

export const fecha = (valor: string | Date) =>
  new Date(valor).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });

export const fechaHora = (valor: string | Date) =>
  new Date(valor).toLocaleString('es-MX', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  });
