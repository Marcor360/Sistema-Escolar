const assert = require('node:assert/strict');
const { sprintf } = require('sprintf-js');

assert.equal(sprintf('offset %d at %s', 7, 'row'), 'offset 7 at row');
for (const tipo of ['e', 'f', 'g']) {
  const resultado = sprintf(`%.10000${tipo}`, 1.25);
  assert.ok(resultado.length > 0 && resultado.length < 120, `Precisión sin límite en %${tipo}`);
}
assert.equal(sprintf('%.0g', 1.25), '1');
