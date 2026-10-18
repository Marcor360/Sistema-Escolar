const test = require('node:test');
const assert = require('node:assert/strict');
const { comparar, partes, validar } = require('./check-pr-version.cjs');

test('solo versiones X.Y.Z', () => {
  assert.deepEqual(partes('1.26.2'), [1, 26, 2]);
  assert.throws(() => partes('1.26.2-beta.1'), /Versión inválida/);
});
test('acepta cambios superiores, de corrección o funcionales', () => {
  for (const actual of ['1.26.2', '1.27.0', '2.0.0']) {
    assert.doesNotThrow(() => validar(actual, '1.26.1'));
    assert.equal(comparar(actual, '1.26.1'), 1);
  }
});
test('rechaza versión repetida e inferior', () => {
  for (const actual of ['1.26.1', '1.26.0', '1.25.99']) {
    assert.throws(() => validar(actual, '1.26.1'), /Cada PR debe incrementar/);
  }
});
