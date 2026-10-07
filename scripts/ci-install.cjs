// Ejecuta npm ci conservando su estado; expone el diagnóstico en las anotaciones
// de Actions cuando el acceso a los archivos de logs no está disponible.
const { spawnSync } = require('node:child_process');
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const result = spawnSync(npmCommand, ['ci'], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
process.stdout.write(result.stdout || '');
process.stderr.write(result.stderr || '');
if (result.error || result.status !== 0) {
  const errors = `${result.stdout || ''}\n${result.stderr || ''}`.split('\n')
    .filter((line) => /^npm (error|ERR!)/.test(line));
  const detail = `npm ci (${process.version}): ${result.error?.message || errors.join('\n') || 'instalación fallida'}`;
  const escaped = detail.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
  console.error(`::error::${escaped}`);
  process.exit(result.status || 1);
}
