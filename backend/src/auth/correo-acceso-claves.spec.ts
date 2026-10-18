import { ConfigService } from '@nestjs/config';
import { ClavesCorreoAcceso } from './correo-acceso-claves';

const config = (values: Record<string, string>) => new ConfigService(values);
describe('ClavesCorreoAcceso', () => {
  const trabajo = { id: 'random-job-id', usuarioId: 5, tipo: 'ACTIVACION' as const, version: 0, claveId: 'v1' };
  const claves = { v1: 'a4'.repeat(32), v2: '7b'.repeat(32) };
  it('sobrevive a reinicio y rotación conservando la clave de cada trabajo', () => {
    const inicial = new ClavesCorreoAcceso(config({ AUTH_OUTBOX_KEYS: JSON.stringify(claves), AUTH_OUTBOX_ACTIVE_KEY: 'v1' }));
    const rotado = new ClavesCorreoAcceso(config({ AUTH_OUTBOX_KEYS: JSON.stringify(claves), AUTH_OUTBOX_ACTIVE_KEY: 'v2' }));
    expect(inicial.token(trabajo)).toMatch(/^[0-9a-f]{64}$/);
    expect(rotado.token(trabajo)).toBe(inicial.token(trabajo));
    expect(rotado.token({ ...trabajo, claveId: 'v2' })).not.toBe(inicial.token(trabajo));
    expect(inicial.token({ ...trabajo, tipo: 'RECUPERACION' })).toHaveLength(32);
    for (const cambio of [{ id: 'otro' }, { usuarioId: 6 }, { version: 1 }]) {
      expect(inicial.token({ ...trabajo, ...cambio })).not.toBe(inicial.token(trabajo));
    }
  });
  it.each(['no-json', '[]', '{"v1":"corta"}', '{"v1":"' + 'zz'.repeat(32) + '"}'])('rechaza claves malformadas sin revelar valores (%#)', json => {
    expect(() => new ClavesCorreoAcceso(config({ AUTH_OUTBOX_KEYS: json, AUTH_OUTBOX_ACTIVE_KEY: 'v1' }))).toThrow('Configura AUTH_OUTBOX_KEYS');
  });
  it('exige clave externa si SMTP está configurado; no reutiliza JWT_SECRET', () => {
    expect(() => new ClavesCorreoAcceso(config({ SMTP_HOST: 'smtp.example.invalid', JWT_SECRET: 'no-reutilizar' }))).toThrow();
    const sinClave = new ClavesCorreoAcceso(config({}));
    expect(() => sinClave.token(trabajo)).toThrow('CLAVE_NO_DISPONIBLE');
  });
});
