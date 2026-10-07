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
// Cadenas de Expo SDK 57: solo herencia de los mismos dos avisos raíz.
const allowedTransitivelyAffected = new Set([
  '@expo/devtools',
  '@expo/dom-webview',
  '@expo/log-box',
  '@expo/router-server',
  '@react-navigation/bottom-tabs',
  '@react-navigation/elements',
  '@react-navigation/native',
  '@react-navigation/native-stack',
  'babel-preset-expo',
  'expo-asset',
  'expo-constants',
  'expo-document-picker',
  'expo-file-system',
  'expo-font',
  'expo-keep-awake',
  'expo-modules-core',
  'expo-modules-jsi',
  'expo-secure-store',
  'expo-splash-screen',
  'expo-status-bar',
  'react-native-safe-area-context',

  '@expo/cli',
  '@expo/code-signing-certificates',
  '@expo/metro',
  '@expo/metro-config',
  '@expo/metro-file-map',
  '@react-native/community-cli-plugin',
  '@react-native/virtualized-lists',
  'braces',
  'expo',
  'metro',
  'metro-config',
  'metro-file-map',
  'metro-transform-worker',
  'micromatch',
  'node-forge',
  'react-native',
  'react-native-screens',
]);
const allowedRootAdvisories = new Map([
  ['node-forge', { source: 1240912, ghsa: 'GHSA-86w9-cpqp-85rv' }],
  ['braces', { source: 1240992, ghsa: 'GHSA-vfj7-8cjw-p6xm' }],
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

if (highs.length === 0) {
  console.log('npm audit móvil: sin vulnerabilidades altas o críticas.');
  process.exit(0);
}

const activeSources = new Set();
for (const [name, { source, ghsa }] of allowedRootAdvisories) {
  const item = vulnerabilities[name];
  if (!item) continue;
  const advisory = (item.via || []).find((via) => typeof via === 'object' &&
    via.source === source && via.url === `https://github.com/advisories/${ghsa}`);
  if (item.severity !== 'high' || !advisory) {
    console.error(`npm audit móvil: la excepción de ${name} ya no coincide con ${ghsa}.`);
    process.exit(1);
  }
  activeSources.add(source);
}

const unexpected = highs.filter((item) => !allowedTransitivelyAffected.has(item.name));
const unexpectedAdvisories = highs.filter((item) => {
  const sources = fuentesDeAvisos(item.name);
  return sources.length === 0 || sources.some((source) => !activeSources.has(source));
});

if (unexpected.length || unexpectedAdvisories.length) {
  console.error('npm audit móvil excedió las excepciones documentadas; revisa las vulnerabilidades nuevas.');
  console.error(`Altas/críticas: ${highs.map((item) => item.name).join(', ') || 'ninguna'}`);
  process.exit(1);
}

console.warn(`npm audit móvil: excepciones activas ${[...allowedRootAdvisories.values()]
  .filter(({ source }) => activeSources.has(source)).map(({ ghsa }) => ghsa).join(', ')}.`);
