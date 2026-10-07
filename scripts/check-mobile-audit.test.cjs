const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { runInNewContext } = require('node:vm');

const code = readFileSync(join(__dirname, 'check-mobile-audit.cjs'), 'utf8');
function check(report, overrides = {}) {
  const stop = new Error('exit');
  let status = 0;
  try {
    runInNewContext(code, {
      require: () => ({ spawnSync: () => ({ stdout: JSON.stringify(report), status: 1, ...overrides }) }),
      process: { platform: 'linux', stderr: { write() {} }, exit(value) { status = value; throw stop; } },
      console: { log() {}, warn() {}, error() {} },
    });
  } catch (error) {
    if (error !== stop) throw error;
  }
  return status;
}
const root = {
  name: 'braces', severity: 'high',
  via: [{ source: 1240992, url: 'https://github.com/advisories/GHSA-vfj7-8cjw-p6xm' }],
};
const report = (vulnerabilities) => ({ metadata: { vulnerabilities: { high: Object.keys(vulnerabilities).length } }, vulnerabilities });

test('acepta únicamente las cadenas SDK 57 del aviso previamente documentado', () => {
  assert.equal(check(report({ braces: root, expo: { name: 'expo', severity: 'high', via: ['braces'] },
    'expo-secure-store': { name: 'expo-secure-store', severity: 'high', via: ['expo'] } })), 0);
});
test('rechaza un aviso nuevo aunque el paquete esté en la lista de cadenas permitidas', () => {
  assert.equal(check(report({ braces: root, expo: { name: 'expo', severity: 'high', via: ['braces',
    { source: 9999999, url: 'https://github.com/advisories/GHSA-new' }] } })), 1);
});
test('rechaza cambios en la URL del aviso permitido', () => {
  assert.equal(check(report({ braces: { ...root, via: [{ source: 1240992, url: 'https://example.invalid' }] } })), 1);
});
test('rechaza paquetes inesperados y causas desconocidas', () => {
  assert.equal(check(report({ braces: root, unknown: { name: 'unknown', severity: 'high', via: ['braces'] } })), 1);
  assert.equal(check(report({ expo: { name: 'expo', severity: 'high', via: ['expo'] } })), 1);
});
test('rechaza fallos de audit y acepta un reporte sin avisos altos', () => {
  assert.equal(check(report({}), { error: new Error('network') }), 1);
  assert.equal(check(report({}), { stdout: 'not json' }), 1);
  assert.equal(check(report({})), 0);
});
