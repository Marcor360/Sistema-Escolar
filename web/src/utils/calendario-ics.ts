const escapar = (v: string) =>
  v.replace(/\\/g, '\\\\').replace(/\r\n|\r|\n/g, '\\n').replace(/;/g, '\\;').replace(/,/g, '\\,');
export function generarIcs(
  eventos: { id: number; titulo: string; fechaInicio: string; fechaFin: string | null; imagenNombre: string | null }[],
) {
  const instante = (s: string) =>
    new Date(s)
      .toISOString()
      .replace(/[-:]/g, '')
      .replace(/\.\d{3}Z$/, 'Z');
  const lineas = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//IUA//Calendario escolar//ES', 'CALSCALE:GREGORIAN'];
  for (const e of eventos.filter((v) => !v.imagenNombre))
    lineas.push(
      'BEGIN:VEVENT',
      'UID:iua-evento-' + e.id + '@escolar.invalid',
      'DTSTAMP:' + instante(new Date().toISOString()),
      'DTSTART:' + instante(e.fechaInicio),
      ...(e.fechaFin ? ['DTEND:' + instante(e.fechaFin)] : []),
      'SUMMARY:' + escapar(e.titulo),
      'END:VEVENT',
    );
  lineas.push('END:VCALENDAR');
  return (
    lineas
      .map((l) => {
        let r = '',
          n = 0;
        for (const c of l) {
          const bytes = new TextEncoder().encode(c).length;
          if (n + bytes > 73) {
            r += '\r\n ';
            n = 1;
          }
          r += c;
          n += bytes;
        }
        return r;
      })
      .join('\r\n') + '\r\n'
  );
}
export function exportarIcs(eventos: Parameters<typeof generarIcs>[0]) {
  const url = URL.createObjectURL(new Blob([generarIcs(eventos)], { type: 'text/calendar;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = 'calendario-escolar.ics';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
