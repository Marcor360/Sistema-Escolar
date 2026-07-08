/** Formato monetario compartido por las pantallas financieras. */
export const pesos = (n: number) =>
  `$${n.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;
