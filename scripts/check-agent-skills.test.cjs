const test = require('node:test');
const assert = require('node:assert/strict');
const { mkdtempSync, mkdirSync, writeFileSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { validarSkill, auditar } = require('./check-agent-skills.cjs');

const valido = '---\nname: iua-prueba\ndescription: Auditar de forma controlada el proyecto escolar con criterios y evidencia reproducible.\n---\n# Prueba\n' + 'Auditar entradas y contratos sin escribir datos sensibles. '.repeat(5);
test('acepta skill con metadatos e instrucciones', () => assert.deepEqual(validarSkill('iua-prueba', valido), []));
test('rechaza nombre inconsistente y contenido corto', () => {
  const errores = validarSkill('otra-skill', '---\nname: iua-prueba\ndescription: corta\n---\nHola');
  assert(errores.some((e) => e.includes('directorio')));
  assert(errores.some((e) => e.includes('description')));
  assert(errores.some((e) => e.includes('instrucciones')));
});
test('falla ante frontmatter inexistente', () => assert.equal(validarSkill('iua-prueba', '# Texto').length, 1));
test('audita directorios en un árbol aislado', () => {
  const raiz = mkdtempSync(join(tmpdir(), 'iua-skills-'));
  try {
    mkdirSync(join(raiz, 'iua-prueba'));
    writeFileSync(join(raiz, 'iua-prueba', 'SKILL.md'), valido);
    assert.deepEqual(auditar(raiz), []);
    mkdirSync(join(raiz, 'iua-faltante'));
    assert(auditar(raiz).some((e) => e.includes('falta SKILL.md')));
  } finally { rmSync(raiz, { recursive: true, force: true }); }
});
