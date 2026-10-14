import { LIMITE_INACTIVIDAD_MS, sesionInactiva } from './sesion-inactividad';

describe('Expiración estricta de sesiones', () => {
  const ahora = new Date('2026-10-14T18:00:00.000Z');

  it('no caduca a los 29:59 minutos de inactividad', () => {
    expect(sesionInactiva(new Date(ahora.getTime() - LIMITE_INACTIVIDAD_MS + 1), ahora)).toBe(false);
  });

  it('caduca exactamente a los 30:00 minutos', () => {
    expect(sesionInactiva(new Date(ahora.getTime() - LIMITE_INACTIVIDAD_MS), ahora)).toBe(true);
  });

  it('rechaza sesiones existentes que no hayan registrado actividad', () => {
    expect(sesionInactiva(null, ahora)).toBe(true);
    expect(sesionInactiva(undefined, ahora)).toBe(true);
  });
});
