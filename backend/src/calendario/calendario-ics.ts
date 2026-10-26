import { BadRequestException } from '@nestjs/common';
export function leerIcs(contenido: string) {
  const lineas = contenido.replace(/\r?\n[ \t]/g, '').split(/\r?\n/);
  const eventos: { uid: string; titulo: string; fechaInicio: string; fechaFin?: string }[] = [];
  let actual: Record<string, string> | null = null;
  const fecha = (v: string, fin = false) => {
    if (/^\d{8}$/.test(v)) {
      const s = v.slice(0, 4) + '-' + v.slice(4, 6) + '-' + v.slice(6, 8);
      const d = new Date(s + 'T00:00:00-06:00');
      if (!Number.isFinite(d.getTime()) || new Date(s).toISOString().slice(0, 10) !== s)
        throw new BadRequestException('Fecha ICS inválida');
      return new Date(d.getTime() - (fin ? 1 : 0)).toISOString();
    }
    if (!/^\d{8}T\d{6}Z$/.test(v))
      throw new BadRequestException(
        'Usa fechas completas o instantes UTC en el ICS; convierte zonas horarias y recurrencias antes de importar',
      );
    const s =
      v.slice(0, 4) +
      '-' +
      v.slice(4, 6) +
      '-' +
      v.slice(6, 8) +
      'T' +
      v.slice(9, 11) +
      ':' +
      v.slice(11, 13) +
      ':' +
      v.slice(13, 15) +
      'Z';
    const d = new Date(s);
    if (!Number.isFinite(d.getTime()) || d.toISOString().replace(/[-:]/g, '').replace('.000', '') !== v)
      throw new BadRequestException('Fecha ICS inválida');
    return d.toISOString();
  };
  for (const linea of lineas) {
    if (linea === 'BEGIN:VEVENT') {
      if (actual) throw new BadRequestException('ICS anidado inválido');
      actual = {};
      continue;
    }
    if (linea === 'END:VEVENT') {
      if (!actual?.UID || !actual.SUMMARY || !actual.DTSTART)
        throw new BadRequestException('Cada evento requiere UID, título y fecha');
      const titulo = actual.SUMMARY.replace(/\\n/gi, ' ')
        .replace(/\\([,;\\])/g, '$1')
        .trim();
      if (!titulo || titulo.length > 150 || actual.UID.length > 500)
        throw new BadRequestException('Título o UID fuera de límite');
      eventos.push({
        uid: actual.UID,
        titulo,
        fechaInicio: fecha(actual.DTSTART),
        ...(actual.DTEND ? { fechaFin: fecha(actual.DTEND, actual.DTEND.length === 8) } : {}),
      });
      actual = null;
      continue;
    }
    if (actual) {
      const i = linea.indexOf(':');
      if (i < 0) continue;
      const llave = linea.slice(0, i),
        valor = linea.slice(i + 1);
      if (/^(RRULE|RDATE|EXDATE|RECURRENCE-ID)/.test(llave))
        throw new BadRequestException('Expande las recurrencias antes de importar');
      if (llave.includes('TZID=')) throw new BadRequestException('Convierte las fechas a UTC antes de importar');
      const campo = llave.split(';')[0];
      if (['UID', 'SUMMARY', 'DTSTART', 'DTEND'].includes(campo)) {
        if (actual[campo]) throw new BadRequestException('Propiedad ICS repetida');
        actual[campo] = valor;
      }
    }
  }
  if (actual || !eventos.length || eventos.length > 100 || new Set(eventos.map((e) => e.uid)).size !== eventos.length)
    throw new BadRequestException('Importa entre 1 y 100 eventos con UID único');
  return eventos;
}
