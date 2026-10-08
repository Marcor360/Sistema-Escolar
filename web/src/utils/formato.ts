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
  new Date(valor).toLocaleDateString('es-MX', {
    day: '2-digit', month: 'short', year: 'numeric',
    ...(typeof valor === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(valor) ? { timeZone: 'UTC' } : {}),
  });

export const fechaHora = (valor: string | Date) =>
  new Date(valor).toLocaleString('es-MX', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  });

/** Día civil del navegador, sin convertirlo primero a día UTC. */
export function diaLocal(valor = new Date()): string {
  return `${valor.getFullYear()}-${String(valor.getMonth() + 1).padStart(2, '0')}-${String(valor.getDate()).padStart(2, '0')}`;
}
export function intervaloDias(desde: string, hasta: string) {
  const inicio = new Date(`${desde}T00:00:00`), fin = new Date(`${hasta}T00:00:00`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(desde) || !/^\d{4}-\d{2}-\d{2}$/.test(hasta) || diaLocal(inicio) !== desde || diaLocal(fin) !== hasta || fin < inicio) throw new Error('Indica un intervalo de fechas válido.');
  fin.setDate(fin.getDate() + 1); fin.setMilliseconds(fin.getMilliseconds() - 1);
  return { desde: inicio.toISOString(), hasta: fin.toISOString() };
}
