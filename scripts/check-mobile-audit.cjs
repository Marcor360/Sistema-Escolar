const { spawnSync } = require('node:child_process');
const audit = process.platform === 'win32'
  ? spawnSync(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', 'npm audit --json'], { encoding: 'utf8' })
  : spawnSync('npm', ['audit', '--json'], { encoding: 'utf8' });
let report;
try { report = JSON.parse(audit.stdout || ''); } catch {
  process.stderr.write(audit.stderr || 'npm audit no devolvió un reporte JSON válido.\n'); process.exit(1);
}
if (audit.error || !report.metadata?.vulnerabilities) {
  process.stderr.write(audit.stderr || 'npm audit no pudo terminar la revisión.\n'); process.exit(1);
}
// Sin excepciones: los dos avisos históricos se corrigen en los parches revisables de mobile/vendor.
const avisos = Object.keys(report.vulnerabilities || {});
const total = report.metadata.vulnerabilities.total ?? Object.values(report.metadata.vulnerabilities).reduce((n, v) => n + Number(v), 0);
if (avisos.length || total || audit.status !== 0) {
  process.stderr.write(`npm audit móvil bloqueado: ${avisos.join(', ') || 'fallo de auditoría'}.\n`); process.exit(1);
}
console.log('npm audit móvil: cero vulnerabilidades, sin excepciones.');
