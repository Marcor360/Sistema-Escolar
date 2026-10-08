import { validarEntorno } from './validar-entorno';
const desarrollo = { NODE_ENV: 'development', DB_TYPE: 'mysql', DB_HOST: 'localhost', DB_PORT: '3306', DB_USER: 'test', DB_PASS: 'secreto-no-imprimir', DB_NAME: 'escolar_test', DB_SYNC: 'false', JWT_SECRET: 'clave-local', UPLOADS_DIR: './uploads', CORS_ORIGINS: 'http://localhost:5173' };
describe('validación central antes de arrancar', () => {
  it('acepta desarrollo explícito y rechaza ausencias sin exponer credenciales', () => {
    expect(validarEntorno(desarrollo)).toEqual(desarrollo);
    for (const key of ['DB_TYPE','DB_HOST','DB_PORT','DB_USER','DB_PASS','DB_NAME','JWT_SECRET','UPLOADS_DIR','NODE_ENV','DB_SYNC']) {
      const env: Record<string, unknown> = { ...desarrollo }; delete env[key];
      expect(() => validarEntorno(env)).toThrow(key);
    }
  });
  it.each([{ DB_PORT: '0' }, { DB_PORT: 'puerto' }, { DB_TYPE: 'sqlite' }, { NODE_ENV: ' production ' }, { DB_SSL: ' true ' }, { DB_SYNC: 'true' }, { PUSH_ENABLED: 'yes' }, { CORS_ORIGINS: '*' }, { SMTP_USER: 'test' }, { OPENPAY_MERCHANT_ID: 'test' }])('rechaza configuración mal formada %j', (cambio) => expect(() => validarEntorno({ ...desarrollo, ...cambio })).toThrow());
  it('exige TLS, secreto y CORS HTTPS incluso en staging; permite proveedores deshabilitados en staging', () => {
    const staging = { ...desarrollo, NODE_ENV: 'production', APP_ENV: 'staging', JWT_SECRET: 'a'.repeat(40), DB_SSL: 'true', CORS_ORIGINS: 'https://portal.example.invalid' };
    expect(() => validarEntorno(staging)).not.toThrow();
    expect(() => validarEntorno({ ...staging, DB_SSL: 'false' })).toThrow('DB_SSL');
    expect(() => validarEntorno({ ...staging, CORS_ORIGINS: 'http://portal.example.invalid' })).toThrow('CORS_ORIGINS');
    expect(() => validarEntorno({ ...staging, APP_ENV: 'production' })).toThrow('SMTP_HOST');
  });
});
