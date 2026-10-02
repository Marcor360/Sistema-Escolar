const { spawnSync } = require('node:child_process');

const audit = process.platform === 'win32'
  ? spawnSync(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', 'npm audit --json'], { encoding: 'utf8' })
  : spawnSync('npm', ['audit', '--json'], { encoding: 'utf8' });
let report;
try {
  report = JSON.parse(audit.stdout || '');
} catch {
  process.stderr.write(audit.stderr || 'npm audit no devolvió un reporte JSON válido.\n');
  process.exit(audit.status || 1);
}
if (audit.error || !report.metadata?.vulnerabilities) {
  process.stderr.write(audit.stderr || 'npm audit no pudo terminar la revisión.\n');
  process.exit(1);
}

const vulnerabilities = report.vulnerabilities || {};
const nodeForge = vulnerabilities['node-forge'];
const allowedTransitivelyAffected = new Set([
  '@expo/cli',
  '@expo/code-signing-certificates',
  'expo',
  'node-forge',
]);
const highs = Object.values(vulnerabilities).filter((item) => item.severity === 'high' || item.severity === 'critical');

function fuentesDeAvisos(nombre, visitados = new Set()) {
  if (visitados.has(nombre)) return [];
  visitados.add(nombre);
  const item = vulnerabilities[nombre];
  if (!item) return [];
  return (item.via || []).flatMap((via) => typeof via === 'string'
    ? fuentesDeAvisos(via, visitados)
    : typeof via.source === 'number' ? [via.source] : []);
}

if (!nodeForge) {
  if (highs.length) {
    console.error(`npm audit detectó vulnerabilidades altas/críticas: ${highs.map((item) => item.name).join(', ')}`);
    process.exit(1);
  }
  console.log('npm audit móvil: sin vulnerabilidades altas o críticas.');
  process.exit(0);
}

const advisory = (nodeForge.via || []).find((item) => typeof item === 'object' && item.source === 1240912);
const unexpected = highs.filter((item) => !allowedTransitivelyAffected.has(item.name));
const unexpectedAdvisories = highs.flatMap((item) => fuentesDeAvisos(item.name))
  .filter((source) => source !== 1240912);
const expectedAffectedMissing = ['@expo/cli', '@expo/code-signing-certificates', 'expo']
  .filter((name) => !vulnerabilities[name] || vulnerabilities[name].severity !== 'high');

if (nodeForge.severity !== 'high' || !advisory || unexpected.length || unexpectedAdvisories.length || expectedAffectedMissing.length) {
  console.error('npm audit móvil excedió la excepción documentada; revisa la nueva vulnerabilidad o elimina la excepción si Expo ya la corrigió.');
  console.error(`Altas/críticas: ${highs.map((item) => item.name).join(', ') || 'ninguna'}`);
  process.exit(1);
}

console.warn('npm audit móvil: solo permanece GHSA-86w9-cpqp-85rv en node-forge, sin corrección disponible en la versión requerida por Expo.');
