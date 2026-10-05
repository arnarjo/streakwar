const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { render } = require('./build-hosted-test-baseline.cjs');
const sql = render();
test('checked-in rehearsal exactly matches renderer', () => {
  assert.equal(sql, fs.readFileSync(path.join(__dirname, '../supabase/tests/hosted-baseline-rehearsal.sql'), 'utf8'));
});
test('rollback-only and refuses existing data', () => {
  assert.match(sql, /EXISTS \(SELECT 1 FROM auth.users\)/);
  assert.match(sql, /Refusing non-empty database/);
  assert.match(sql, /ROLLBACK;\n$/);
  assert.doesNotMatch(sql, /^\s*(?:COMMIT\b|DROP\b|TRUNCATE\s+TABLE\b)/im);
  assert.match(sql, /vqizpuqmsykmhlyihyry/);
});
test('no schedule, seed, credential RPC or external network activation', () => {
  assert.doesNotMatch(sql, /cron\.schedule|net\.http|vault\.|CREATE.+get_device_connection_decrypted|CREATE.+upsert_encrypted_device_tokens/i);
  assert.doesNotMatch(sql, /INSERT INTO (?:public\.)?fitness_challenges[\s\S]*VALUES\s*\('/i);
  assert.equal((sql.match(/CREATE TABLE public\./g) || []).length, 22);
  assert.equal((sql.match(/ALTER TABLE public\..*ENABLE ROW LEVEL SECURITY/g) || []).length, 22);
  assert.match(sql, /ALTER TABLE streakwar_test_control.environment ENABLE ROW LEVEL SECURITY/);
});
test('least privilege overrides are explicit', () => {
  assert.equal((sql.match(/REVOKE ALL ON TABLE public\./g) || []).length, 22);
  assert.equal((sql.match(/REVOKE ALL ON FUNCTION public\./g) || []).length, 20);
  assert.doesNotMatch(sql, /GRANT (?:TRUNCATE|TRIGGER|REFERENCES).*TO authenticated/i);
  assert.doesNotMatch(sql, /GRANT .*TO anon;/i);
  assert.match(sql, /Protected column grant regression/);
});
