// Validación estructural en CI; --release exige evidencia institucional de todas las puertas.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const gates = JSON.parse(fs.readFileSync(path.join(root, 'docs/BETA_ACEPTACION.json'), 'utf8'));
const version = JSON.parse(fs.readFileSync(path.join(root, 'backend/package.json'), 'utf8')).version;
const required = ['ci_ultimo_sha', 'web_api_motores', 'android_fisico', 'ios_fisico', 'smtp_staging', 'antivirus_real', 'restore_operativo', 'uat_roles'];
if (gates.version !== version || required.some((id) => !gates.puertas.some((g) => g.id === id))) throw Error('Puertas de beta incompletas o versión divergente');
for (const g of gates.puertas) {
  if (!['pendiente', 'aprobada'].includes(g.estado) || !g.responsable || !Array.isArray(g.evidencias)) throw Error(`Puerta inválida: ${g.id}`);
  if (g.estado === 'aprobada' && (!g.fecha || !g.sha || !/^[a-f0-9]{40}$/.test(g.sha) || !g.evidencias.length || !g.aprobadoPor)) throw Error(`Falta evidencia verificable en ${g.id}`);
}
const pending = gates.puertas.filter((g) => g.estado !== 'aprobada');
console.log(`Beta ${version}: ${pending.length} puertas institucionales pendientes: ${pending.map((g) => g.id).join(', ')}`);
if (process.argv.includes('--release') && pending.length) { console.error('No aceptada para release: faltan pruebas o firmas institucionales.'); process.exitCode = 1; }
