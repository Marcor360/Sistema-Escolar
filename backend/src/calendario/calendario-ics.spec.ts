import { leerIcs } from './calendario-ics';
const archivo = (contenido: string) =>
  'BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:prueba\r\nSUMMARY:Clase\r\n' + contenido + '\r\nEND:VEVENT\r\nEND:VCALENDAR';
it('convierte fechas civiles y fin exclusivo sin cambiar el día escolar', () => {
  const [e] = leerIcs(archivo('DTSTART;VALUE=DATE:20261026\r\nDTEND;VALUE=DATE:20261028'));
  expect(e.fechaInicio).toBe('2026-10-26T06:00:00.000Z');
  expect(e.fechaFin).toBe('2026-10-28T05:59:59.999Z');
});
it('rechaza recurrencias que no pueden importarse como fechas individuales', () => {
  expect(() => leerIcs(archivo('DTSTART:20261026T120000Z\r\nRRULE:FREQ=DAILY'))).toThrow('recurrencias');
});
it('rechaza fechas inexistentes, zonas no convertidas y UID duplicado', () => {
  expect(() => leerIcs(archivo('DTSTART;VALUE=DATE:20260230'))).toThrow();
  expect(() => leerIcs(archivo('DTSTART;TZID=America/Mexico_City:20261026T120000'))).toThrow('UTC');
  const a = archivo('DTSTART:20261026T120000Z');
  expect(() => leerIcs(a + a)).toThrow('UID único');
});
