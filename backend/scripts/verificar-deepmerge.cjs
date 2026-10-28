const assert = require('node:assert/strict');
function verificarFusiones(merges) {
  for (const merge of merges) {
    const normal = { ios: { infoPlist: { Nombre: 'Escuela' } }, plugins: ['uno'] };
    const combinado = merge(normal, { ios: { infoPlist: { Idioma: 'es' } }, plugins: ['dos'] });
    assert.deepEqual(combinado, { ios: { infoPlist: { Nombre: 'Escuela', Idioma: 'es' } }, plugins: ['uno', 'dos'] });
    assert.deepEqual(normal.plugins, ['uno']);
    const simbolo = Symbol('config');
    assert.deepEqual(merge({ [simbolo]: { a: 1 } }, { [simbolo]: { b: 2 } })[simbolo], { a: 1, b: 2 });
    for (const clone of [true, false]) {
      const payload = JSON.parse('{"__proto__":{"escolarPoisoned":true}}');
      for (const resultado of [merge(payload, {}, { clone }), merge(Object.create(null), payload, { clone })]) {
        assert.equal(Object.getPrototypeOf(resultado), Object.prototype);
        assert.equal(resultado.escolarPoisoned, undefined);
        assert.equal(Object.hasOwn(resultado, '__proto__'), false);
      }
    }
    assert.equal(Object.prototype.escolarPoisoned, undefined);
    let escrituras = 0;
    const anterior = Object.getOwnPropertyDescriptor(Object.prototype, 'escolarSetter');
    try {
      Object.defineProperty(Object.prototype, 'escolarSetter', {
        configurable: true,
        set() {
          escrituras++;
        },
      });
      const resultado = merge(JSON.parse('{"escolarSetter":7}'), {});
      assert.equal(escrituras, 0);
      assert.equal(Object.getOwnPropertyDescriptor(resultado, 'escolarSetter').value, 7);
    } finally {
      if (anterior) Object.defineProperty(Object.prototype, 'escolarSetter', anterior);
      else delete Object.prototype.escolarSetter;
    }
  }
}
module.exports = { verificarFusiones };
if (require.main === module) {
  const { createRequire } = require('node:module');
  const { resolve } = require('node:path');
  const { readFileSync } = require('node:fs');
  const { createHash } = require('node:crypto');
  const manifest = JSON.parse(readFileSync(resolve(__dirname, '../vendor/deepmerge-upstream.json'), 'utf8'));
  const archivo = readFileSync(resolve(__dirname, '../vendor', manifest.archive));
  assert.equal('sha512-' + createHash('sha512').update(archivo).digest('base64'), manifest.patchedIntegrity);
  const desdeJest = createRequire(require.resolve('jest-config'));
  const desdeNestCli = createRequire(require.resolve('@nestjs/cli/package.json'));
  const desdeNestChecker = createRequire(desdeNestCli.resolve('fork-ts-checker-webpack-plugin'));
  for (const loader of [require, desdeJest, desdeNestChecker])
    assert.equal(loader('deepmerge/package.json').version, '4.3.2-escolar.0');
  verificarFusiones([
    require('deepmerge'),
    require('deepmerge/dist/umd.js'),
    desdeJest('deepmerge'),
    desdeNestChecker('deepmerge'),
  ]);
  console.log('Deepmerge backend: Jest y Nest resuelven el parche; configuración normal y prototipos verificados.');
}
