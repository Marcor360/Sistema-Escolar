/** Fecha civil de la sede: evita diferencias de formato de Intl entre Android, iOS y navegador. */
export function diaCalendarioEscolar(valor: string): string {
  const partes = new Intl.DateTimeFormat("es-MX", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(valor));
  const campo = (tipo: "year" | "month" | "day") => partes.find((p) => p.type === tipo)?.value ?? "";
  return `${campo("year")}-${campo("month")}-${campo("day")}`;
}

export function mesInicialCalendario(inicio: string, fin: string, diaActual: string): string {
  const mesActual = diaActual.slice(0, 7);
  const mesInicio = inicio.slice(0, 7);
  const mesFin = fin.slice(0, 7);
  return mesActual >= mesInicio && mesActual <= mesFin ? mesActual : mesInicio;
}

export interface EventoCalendarioAlumno {
  id: number;
  fechaInicio: string;
  fechaFin: string | null;
  imagenNombre: string | null;
}

/** Un rango inclusivo puede abarcar varios días. Las imágenes no son eventos de fecha. */
export function eventosDelDia<T extends EventoCalendarioAlumno>(eventos: T[], fecha: string): T[] {
  return eventos.filter((e) => !e.imagenNombre &&
    diaCalendarioEscolar(e.fechaInicio) <= fecha &&
    diaCalendarioEscolar(e.fechaFin ?? e.fechaInicio) >= fecha);
}
