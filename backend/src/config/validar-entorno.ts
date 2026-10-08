/** Validación única antes de construir providers. Los errores nombran variables, nunca valores. */
export function validarEntorno(entrada: Record<string, unknown>): Record<string, unknown> {
  const env = { ...entrada };
  const error = (nombre: string): never => { throw new Error(`Configuración inválida: ${nombre}`); };
  const texto = (nombre: string, requerido = false) => {
    const v = env[nombre];
    if (v !== undefined && typeof v !== 'string') error(nombre);
    const s = typeof v === 'string' ? v.trim() : '';
    if (requerido && !s) error(nombre);
    return s;
  };
  const booleano = (nombre: string) => { const v = texto(nombre); if (v && (env[nombre] !== v || !['true','false'].includes(v))) error(nombre); return v === 'true'; };
  const puerto = (nombre: string) => { const v = texto(nombre); if (v && (!/^\d+$/.test(v) || Number(v) < 1 || Number(v) > 65535)) error(nombre); };
  const modo = texto('NODE_ENV', true); if (env.NODE_ENV !== modo || !['development','test','production'].includes(modo)) error('NODE_ENV');
  const prod = modo === 'production', proveedorProduccion = prod && texto('APP_ENV') !== 'staging';
  const motor = texto('DB_TYPE', true); if (env.DB_TYPE !== motor || !['mysql','mssql'].includes(motor)) error('DB_TYPE');
  for (const n of ['DB_HOST','DB_USER','DB_PASS','DB_NAME','DB_PORT','JWT_SECRET','UPLOADS_DIR']) texto(n, true);
  for (const n of ['PORT','DB_PORT','SMTP_PORT']) puerto(n);
  if (texto('DB_SYNC', true) !== 'false') error('DB_SYNC (debe ser false; usa migraciones)');
  for (const n of ['DB_SSL','DB_ENCRYPT','DB_TRUST_SERVER_CERTIFICATE','PUSH_ENABLED','ALLOW_DEV_SEED']) booleano(n);
  if (prod && (texto('JWT_SECRET').length < 32 || texto('JWT_SECRET').includes('cambiar-en-produccion'))) error('JWT_SECRET');
  if (prod && motor === 'mysql' && !booleano('DB_SSL')) error('DB_SSL');
  if (prod && motor === 'mssql' && (texto('DB_ENCRYPT') === 'false' || booleano('DB_TRUST_SERVER_CERTIFICATE'))) error('DB_ENCRYPT / DB_TRUST_SERVER_CERTIFICATE');
  const origenes = texto('CORS_ORIGINS', prod);
  if (origenes) for (const origen of origenes.split(',')) {
    let url: URL; try { url = new URL(origen.trim()); } catch { error('CORS_ORIGINS'); }
    if (!['http:','https:'].includes(url!.protocol) || url!.origin !== origen.trim() || (prod && url!.protocol !== 'https:')) error('CORS_ORIGINS');
  }
  const max = texto('MAX_UPLOAD_MB'); if (max && (!/^\d+$/.test(max) || Number(max) < 1 || Number(max) > 50)) error('MAX_UPLOAD_MB');
  if (!!texto('SMTP_USER') !== !!texto('SMTP_PASS')) error('SMTP_USER / SMTP_PASS');
  if (proveedorProduccion) for (const n of ['SMTP_HOST','SMTP_USER','SMTP_PASS','SMTP_FROM','OPENPAY_MERCHANT_ID','OPENPAY_PRIVATE_KEY','OPENPAY_BASE_URL','OPENPAY_REDIRECT_URL','OPENPAY_WEBHOOK_USER','OPENPAY_WEBHOOK_PASS']) texto(n, true);
  for (const [a,b] of [['OPENPAY_MERCHANT_ID','OPENPAY_PRIVATE_KEY'],['OPENPAY_WEBHOOK_USER','OPENPAY_WEBHOOK_PASS']]) if (!!texto(a) !== !!texto(b)) error(`${a} / ${b}`);
  for (const n of ['OPENPAY_BASE_URL','OPENPAY_REDIRECT_URL']) {
    const valor = texto(n); if (!valor) continue;
    let url: URL; try { url = new URL(valor); } catch { error(n); }
    if (!['http:','https:'].includes(url!.protocol) || url!.username || url!.password) error(n);
    if (proveedorProduccion && url!.protocol !== 'https:') error(n);
    if (n === 'OPENPAY_BASE_URL' && !['https://api.openpay.mx/v1','https://sandbox-api.openpay.mx/v1'].includes(valor.replace(/\/$/,''))) error(n);
  }
  if (booleano('PUSH_ENABLED') && env.EXPO_ACCESS_TOKEN !== undefined && !texto('EXPO_ACCESS_TOKEN')) error('EXPO_ACCESS_TOKEN');
  return env;
}
