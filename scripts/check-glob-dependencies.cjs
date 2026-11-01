const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const { resolve } = require('node:path');
const { readFileSync } = require('node:fs');
const { createHash } = require('node:crypto');
const manifest = require('./legacy-glob-manifest.json');
const workspace = process.argv[2];
assert.ok(['backend', 'web', 'mobile'].includes(workspace), 'Indica backend, web o mobile');
const root = resolve(__dirname, '..', workspace);
const req = createRequire(resolve(root, 'package.json'));
const pkg = req('./package.json');
for (const entry of manifest) {
  const alias = `${entry.name}-legacy${entry.upstreamVersion.split('.')[0]}`;
  if (!pkg.devDependencies[alias]) continue;
  const archive = readFileSync(resolve(root, 'vendor', entry.archive));
  assert.equal('sha512-' + createHash('sha512').update(archive).digest('base64'), entry.integrity);
  assert.equal(req(`${alias}/package.json`).version, entry.version);
  if (entry.name === 'minimatch') {
    const match = req(alias);
    assert.equal(typeof match, 'function');
    assert.equal(match('src/prueba.ts', '**/*.ts'), true);
    assert.equal(match('src/prueba.js', '**/*.ts'), false);
    assert.equal(match.Minimatch.prototype.firstPhasePreProcess, undefined);
    assert.equal(match.Minimatch.prototype.secondPhasePreProcess, undefined);
  } else {
    const glob = req(alias);
    assert.equal(typeof glob, 'function');
    assert.ok(glob.sync('package.json', { cwd: root }).includes('package.json'));
    assert.equal(typeof glob.Glob.prototype.abort, 'function');
  }
}
const { Minimatch } = req('minimatch');
// Los consumidores modernos no permiten expansión exponencial sin límite.
if (typeof Minimatch.prototype.firstPhasePreProcess === 'function') {
  const pattern = Array(30).fill('**/../a/b').join('/');
  const mm = new Minimatch(pattern, { optimizationLevel: 2, braceExpandMax: 64 });
  assert.ok(mm.set.length <= 64);
  assert.equal(new Minimatch('**/*.ts').match('src/prueba.ts'), true);
}
console.log(`${workspace}: integridades, APIs y límites de patrones verificados`);
