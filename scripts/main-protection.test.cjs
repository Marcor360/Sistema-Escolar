const { test } = require('node:test');
const assert = require('node:assert/strict');
const { verificar } = require('./main-protection.cjs');
const policy = require('../.github/main-protection.json');
const actual = () => ({ ...structuredClone(policy), enforce_admins: { enabled: true }, required_conversation_resolution: { enabled: true }, allow_force_pushes: { enabled: false }, allow_deletions: { enabled: false } });
test('acepta política efectiva completa', () => assert.deepEqual(verificar(actual()), []));
test('rechaza checks de otra app y ausencia de revisión independiente', () => {
  const a = actual(); a.required_status_checks.checks[0].app_id = 1; a.required_pull_request_reviews.require_last_push_approval = false;
  assert.equal(verificar(a).length, 2);
});
test('rechaza bypass de administrador, force push, borrado y excepciones', () => {
  const a = actual(); a.enforce_admins.enabled = false; a.allow_force_pushes.enabled = true; a.allow_deletions.enabled = true; a.required_pull_request_reviews.bypass_pull_request_allowances = { users: [{ login: 'admin' }] };
  assert.equal(verificar(a).length, 4);
});
