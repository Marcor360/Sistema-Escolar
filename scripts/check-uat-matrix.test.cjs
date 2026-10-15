const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validarMatriz } = require('./check-uat-matrix.cjs');
const original = require('../docs/UAT_MATRIZ_2026-10-15.json');
const copia = () => structuredClone(original);
test('la matriz institucional continúa pendiente y bloquea release', () => {
  assert.equal(validarMatriz(copia(), original.version).pendientes, 12);
  assert.throws(() => validarMatriz(copia(), original.version, true), /incompleta/);
});
test('rechaza eliminación de escenarios, duplicados y canales desconocidos', () => {
  for (const mutar of [m => m.escenarios.pop(), m => { m.escenarios[1].id = m.escenarios[0].id; }, m => { m.escenarios[0].canales = ['inexistente']; }]) {
    const m = copia(); mutar(m); assert.throws(() => validarMatriz(m, original.version));
  }
});
test('aprobaciones sintéticas solo validan con fecha, SHA, firma y referencias completas', () => {
  const m = copia();
  for (const c of m.escenarios) Object.assign(c, { estado: 'aprobada', responsable: 'Responsable sintético', aprobadoPor: 'Firmante sintético', fecha: '2020-01-01T00:00:00.000Z', sha: 'a'.repeat(40), evidencias: ['fixture de prueba; no acredita UAT real'] });
  assert.equal(validarMatriz(m, original.version, true).pendientes, 0);
  for (const cambio of [{ aprobadoPor: ' ' }, { fecha: 'ayer' }, { fecha: '2999-01-01T00:00:00.000Z' }, { sha: 'abc' }, { evidencias: [''] }, { responsable: 'Por designar' }]) {
    const invalida = structuredClone(m); Object.assign(invalida.escenarios[0], cambio);
    assert.throws(() => validarMatriz(invalida, original.version, true));
  }
});
