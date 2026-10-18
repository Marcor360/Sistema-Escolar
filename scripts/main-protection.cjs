const { execFileSync } = require('node:child_process');
const policy = require('../.github/main-protection.json');
function verificar(actual) {
  const errores = [];
  const exigir = (ok, mensaje) => { if (!ok) errores.push(mensaje); };
  exigir(actual.enforce_admins?.enabled, 'Administradores sujetos a las reglas');
  exigir(actual.required_status_checks?.strict, 'Rama actualizada antes de integrar');
  for (const check of policy.required_status_checks.checks) exigir(actual.required_status_checks?.checks?.some(c => c.context === check.context && c.app_id === check.app_id), `Check obligatorio de GitHub Actions: ${check.context}`);
  const reviews = actual.required_pull_request_reviews;
  exigir(reviews?.required_approving_review_count >= 1 && reviews.dismiss_stale_reviews && reviews.require_last_push_approval, 'Revisión independiente vigente del último push');
  exigir(!reviews?.bypass_pull_request_allowances || Object.values(reviews.bypass_pull_request_allowances).every(v => Array.isArray(v) && v.length === 0), 'Sin excepciones de revisión');
  exigir(actual.required_conversation_resolution?.enabled, 'Conversaciones resueltas');
  exigir(actual.allow_force_pushes?.enabled === false, 'Sin force push');
  exigir(actual.allow_deletions?.enabled === false, 'Sin borrado de main');
  return errores;
}
if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.some(a => !['--apply'].includes(a))) throw Error('Uso: node scripts/main-protection.cjs [--apply]');
  const ruta = 'repos/Marcor360/Sistema-Escolar/branches/main/protection';
  const api = (extra = [], input) => JSON.parse(execFileSync('gh', ['api', ruta, ...extra], { encoding: 'utf8', ...(input ? { input } : {}) }));
  if (args.includes('--apply')) api(['--method', 'PUT', '--input', '-'], JSON.stringify(policy));
  const errores = verificar(api());
  if (errores.length) { console.error(errores.join('\n')); process.exitCode = 1; }
  else console.log('main: protección obligatoria verificada, ocho checks y revisión independiente, sin bypass.');
}
module.exports = { verificar };
