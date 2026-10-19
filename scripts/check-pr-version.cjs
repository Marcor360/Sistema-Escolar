// Valida el avance de versión frente a la rama base, no frente al servidor desplegado.
const { execFileSync } = require('node:child_process');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const raiz = path.resolve(__dirname, '..');

function partes(version) {
  const partesVersion = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  if (!partesVersion) throw new Error(`Versión inválida: ${version}; usar X.Y.Z sin sufijos`);
  return partesVersion.slice(1).map(Number);
}
function comparar(actual, base) {
  const a = partes(actual), b = partes(base);
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return Math.sign(a[i] - b[i]);
  return 0;
}
function validar(actual, base) {
  if (comparar(actual, base) <= 0) throw new Error(`Cada PR debe incrementar versión: base ${base}, propuesta ${actual}`);
}
function ejecutar() {
  if (process.env.GITHUB_EVENT_NAME !== 'pull_request') {
    process.stdout.write('Control de incremento de PR omitido fuera de pull_request.\n');
    return;
  }
  const base = process.env.GITHUB_BASE_REF;
  if (!base || !/^[\w./-]+$/.test(base) || base.includes('..')) throw new Error('GITHUB_BASE_REF inválida');
  const actual = JSON.parse(readFileSync(path.join(raiz, 'backend/package.json'), 'utf8')).version;
  const contenido = execFileSync('git', ['show', `origin/${base}:backend/package.json`], { cwd: raiz, encoding: 'utf8' });
  validar(actual, JSON.parse(contenido).version);
  process.stdout.write(`Versionado válido: ${JSON.parse(contenido).version} → ${actual}.\n`);
}
if (require.main === module) {
  try { ejecutar(); } catch (e) { process.stderr.write(`${e.message}\n`); process.exitCode = 1; }
}
module.exports = { partes, comparar, validar };
