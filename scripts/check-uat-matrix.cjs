const fs = require('node:fs');
const path = require('node:path');
const { version } = require('../backend/package.json');
const file = path.join(__dirname, '..', 'docs/UAT_MATRIZ_2026-10-15.json');
const matriz = JSON.parse(fs.readFileSync(file, 'utf8'));
const roles = ['SUPERADMIN','ADMINISTRATIVO','MAESTRO','ALUMNO','FINANZAS'];
if (matriz.version !== version || !Array.isArray(matriz.escenarios) || matriz.escenarios.length < 10) {
  throw Error('La matriz UAT no corresponde a la versión o carece de escenarios.');
}
const ids = new Set();
for (const caso of matriz.escenarios) {
  if (ids.has(caso.id) || !/^UAT-\d{2}$/.test(caso.id) || !roles.includes(caso.rol) ||
    !caso.escenario || !Array.isArray(caso.canales) || caso.canales.length === 0 ||
    !['pendiente','aprobada'].includes(caso.estado) || !caso.responsable ||
    !Array.isArray(caso.evidencias)) throw Error('Escenario UAT incompleto o duplicado: ' + caso.id);
  ids.add(caso.id);
  if (caso.estado === 'aprobada' && (!caso.fecha || !caso.aprobadoPor || caso.evidencias.length === 0))
    throw Error('No se permite aprobar UAT sin firma y evidencia: ' + caso.id);
}
for (const rol of roles) if (!matriz.escenarios.some((caso) => caso.rol === rol))
  throw Error('Faltan casos para rol: ' + rol);
const pendientes = matriz.escenarios.filter((caso) => caso.estado !== 'aprobada');
console.log('Matriz UAT: ' + matriz.escenarios.length + ' escenarios, ' + pendientes.length + ' pendientes.');
if (process.argv.includes('--release') && pendientes.length) process.exitCode = 1;
