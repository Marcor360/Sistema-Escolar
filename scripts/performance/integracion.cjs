// Carga reproducible con escrituras exclusivamente en una base nueva de integración.
// Ejecuta también las regresiones y el baseline/migraciones antes de generar los datos.
const { spawnSync } = require('node:child_process');
const { resolve } = require('node:path');
if (process.env.RUN_DB_INTEGRATION !== '1' || process.env.DB_SYNC !== 'false' ||
    process.env.NODE_ENV === 'production' || !/^escolar_integration_[a-z0-9_]+$/i.test(process.env.DB_NAME || '')) {
  throw new Error('Exige RUN_DB_INTEGRATION=1, DB_SYNC=false y DB_NAME escolar_integration_* nueva; se rechaza producción.');
}
const backend = resolve(__dirname, '../../backend');
const result = spawnSync(process.execPath, [resolve(backend, 'node_modules/jest/bin/jest.js'), '--config', 'jest.integration.config.cjs', '--runInBand'], {
  cwd: backend, stdio: 'inherit', env: process.env,
});
if (result.error) throw result.error;
process.exit(result.status ?? 1);
