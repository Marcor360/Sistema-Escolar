const fs = require('node:fs');
const path = require('node:path');
const roles = ['SUPERADMIN', 'ADMINISTRATIVO', 'MAESTRO', 'ALUMNO', 'FINANZAS'];
const canales = ['web', 'api', 'mysql', 'sqlserver', 'smtp', 'android', 'ios', 'openpay', 'antivirus', 'windows', 'ux'];
const texto = (valor) => typeof valor === 'string' && valor.trim().length > 0;

function validarMatriz(matriz, version, release = false) {
  if (!matriz || matriz.version !== version || !Array.isArray(matriz.escenarios)) throw Error('Versión o estructura UAT inválida.');
  const ids = new Set();
  for (const caso of matriz.escenarios) {
    if (!caso || ids.has(caso.id) || !/^UAT-\d{2}$/.test(caso.id) || !roles.includes(caso.rol) ||
      !texto(caso.escenario) || !Array.isArray(caso.canales) || caso.canales.length === 0 ||
      caso.canales.some(c => !canales.includes(c)) || new Set(caso.canales).size !== caso.canales.length ||
      !['pendiente', 'aprobada'].includes(caso.estado) || !texto(caso.responsable) ||
      !Array.isArray(caso.evidencias) || caso.evidencias.some(e => !texto(e))) throw Error('Escenario UAT incompleto o duplicado: ' + caso?.id);
    ids.add(caso.id);
    if (caso.estado === 'aprobada') {
      const fecha = typeof caso.fecha === 'string' ? new Date(caso.fecha) : new Date(NaN);
      if (!texto(caso.aprobadoPor) || !/^\d{4}-\d{2}-\d{2}T/.test(caso.fecha ?? '') ||
        !Number.isFinite(fecha.getTime()) || fecha.toISOString() !== caso.fecha || fecha.getTime() > Date.now() ||
        !/^[a-f0-9]{40}$/.test(caso.sha ?? '') || !caso.evidencias.length || /por designar/i.test(caso.responsable))
        throw Error('Aprobación UAT sin fecha, SHA, firma y evidencia válidas: ' + caso.id);
    }
  }
  for (let i = 1; i <= 12; i++) if (!ids.has('UAT-' + String(i).padStart(2, '0'))) throw Error('Falta un escenario institucional obligatorio.');
  for (const rol of roles) if (!matriz.escenarios.some(c => c.rol === rol)) throw Error('Falta rol: ' + rol);
  for (const canal of canales) if (!matriz.escenarios.some(c => c.canales.includes(canal))) throw Error('Falta canal: ' + canal);
  const pendientes = matriz.escenarios.filter(c => c.estado !== 'aprobada').length;
  if (release && pendientes) throw Error('Aceptación UAT incompleta: ' + pendientes + ' pendientes.');
  return { escenarios: matriz.escenarios.length, pendientes };
}
module.exports = { validarMatriz };
if (require.main === module) {
  try {
    const matriz = JSON.parse(fs.readFileSync(path.join(__dirname, '../docs/UAT_MATRIZ_2026-10-15.json'), 'utf8'));
    const { version } = require('../backend/package.json');
    const resultado = validarMatriz(matriz, version, process.argv.includes('--release'));
    console.log(`Matriz UAT: ${resultado.escenarios} escenarios, ${resultado.pendientes} pendientes.`);
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
