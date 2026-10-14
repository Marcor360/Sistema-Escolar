/** Las fechas escolares se muestran en la zona de operación, no la zona del teléfono. */
export function fechaHoraEscolar(valor: string): string {
  return new Date(valor).toLocaleString("es-MX", {
    timeZone: "America/Mexico_City",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
