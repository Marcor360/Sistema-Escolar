import { expect, it, vi } from 'vitest';
import { fecha } from './formato';
it('conserva el día civil del vencimiento en un cliente de México', () => {
  vi.stubEnv('TZ', 'America/Mexico_City');
  try { expect(fecha('2027-01-05')).toBe(new Date('2027-01-05T12:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })); }
  finally { vi.unstubAllEnvs(); }
});
it('consulta todos los instantes de los días locales y rechaza fechas civiles imposibles', async () => {
  const { intervaloDias } = await import('./formato');
  const desde = new Date('2027-01-05T00:00:00'), hasta = new Date('2027-01-05T23:59:59.999');
  expect(intervaloDias('2027-01-05','2027-01-05')).toEqual({ desde: desde.toISOString(), hasta: hasta.toISOString() });
  expect(() => intervaloDias('2027-02-29','2027-03-01')).toThrow(); expect(() => intervaloDias('2027-01-06','2027-01-05')).toThrow();
});
