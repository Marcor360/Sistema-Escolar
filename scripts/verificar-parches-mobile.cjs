const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const { resolve } = require('node:path');
const requireMobile = createRequire(resolve(__dirname, '../mobile/package.json'));
const braces = requireMobile('braces');
const forge = requireMobile('node-forge');
const requireCertificados = createRequire(requireMobile.resolve('@expo/code-signing-certificates'));
const requireMicromatch = createRequire(requireMobile.resolve('micromatch'));
assert.equal(requireCertificados('node-forge/package.json').version, '1.4.1-escolar.0');
assert.equal(requireMicromatch('braces/package.json').version, '3.0.4-escolar.0');
assert.equal(requireMobile('braces/package.json').version, '3.0.4-escolar.0');
assert.equal(requireMobile('node-forge/package.json').version, '1.4.1-escolar.0');
assert.deepEqual(braces('a/{b,c}/d', { expand: true }), ['a/b/d', 'a/c/d']);
assert.deepEqual(braces('{1..3}', { expand: true }), ['1', '2', '3']);
const patron = '{'.repeat(4000) + 'a,b' + '}'.repeat(4000);
for (const f of [braces.parse, braces.compile, braces.expand]) assert.throws(() => f(patron), /maximum depth/);
const parentesis = '('.repeat(4000) + 'x' + ')'.repeat(4000);
assert.throws(() => braces(parentesis), /maximum depth/);
let ast = { type: 'text', value: 'x' };
for (let i = 0; i < 4000; i++) ast = { type: 'root', nodes: [ast] };
for (const f of [braces.compile, braces.expand, braces.stringify]) assert.throws(() => f(ast), /maximum depth/);
const keys = forge.pki.rsa.generateKeyPair({ bits: 1024, e: 65537 });
const md = forge.md.sha256.create().update('regresión escolar'); const digest = md.digest().getBytes();
assert.equal(keys.publicKey.verify(digest, keys.privateKey.sign(md)), true);
const a = forge.asn1; const u = a.Class.UNIVERSAL; const t = a.Type;
const algoritmo = [a.create(u, t.OID, false, a.oidToDer(forge.pki.oids.sha256).getBytes()), a.create(u, t.NULL, false, '')];
function firmar(extra, parametros = algoritmo) {
  const info = a.create(u, t.SEQUENCE, true, [a.create(u, t.SEQUENCE, true, [...parametros, ...extra]), a.create(u, t.OCTETSTRING, false, digest)]);
  return keys.privateKey.sign(a.toDer(info).getBytes(), 'NONE');
}
assert.equal(keys.publicKey.verify(digest, firmar([])), true);
assert.equal(keys.publicKey.verify(digest, firmar([], algoritmo.slice(0, 1))), true);
assert.throws(() => keys.publicKey.verify(digest, firmar([a.create(u, t.OCTETSTRING, false, 'garbage')])), /valid RSASSA/);
assert.throws(() => keys.publicKey.verify(digest, firmar([a.create(u, t.NULL, false, '')])), /valid RSASSA/);
console.log('Parches móvil: patrones normales y firmas válidas aceptados; anidación excesiva y DigestAlgorithm adulterado rechazados.');

// GHSA-gcqx-w48m-w2h4: proteger ambas entradas y la copia del target.
const { readFileSync } = require('node:fs');
const { createHash } = require('node:crypto');
const manifiesto = JSON.parse(readFileSync(resolve(__dirname, '../mobile/vendor/upstream.json'), 'utf8'));
const archivoDeepmerge = readFileSync(resolve(__dirname, '../mobile/vendor', manifiesto.deepmerge.archive));
assert.equal('sha512-' + createHash('sha512').update(archivoDeepmerge).digest('base64'), manifiesto.deepmerge.patchedIntegrity);
const requireExpoConfig = createRequire(requireMobile.resolve('@expo/config'));
assert.equal(requireExpoConfig('deepmerge/package.json').version, '4.3.2-escolar.0');
assert.equal(requireMobile('deepmerge/package.json').version, '4.3.2-escolar.0');
for (const merge of [requireMobile('deepmerge'), requireMobile('deepmerge/dist/umd.js'), requireExpoConfig('deepmerge')]) {
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
    Object.defineProperty(Object.prototype, 'escolarSetter', { configurable: true, set() { escrituras++; } });
    const resultado = merge(JSON.parse('{"escolarSetter":7}'), {});
    assert.equal(escrituras, 0);
    assert.equal(Object.getOwnPropertyDescriptor(resultado, 'escolarSetter').value, 7);
  } finally {
    if (anterior) Object.defineProperty(Object.prototype, 'escolarSetter', anterior);
    else delete Object.prototype.escolarSetter;
  }
}
console.log('Deepmerge: Expo resuelve el parche; configuración, arrays y símbolos conservados; prototipos y setters protegidos.');
