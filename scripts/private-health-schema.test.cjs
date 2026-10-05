const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const sql = fs.readFileSync(path.join(__dirname, '../supabase/tests/private-health-schema.sql'), 'utf8');
test('private candidate is guarded and never commits or rewrites existing data', () => {
  assert.match(sql, /EXISTS\(SELECT 1 FROM auth.users\)|EXISTS \(SELECT 1 FROM auth.users\)/);
  assert.match(sql, /vqizpuqmsykmhlyihyry/);
  assert.doesNotMatch(sql, /^\s*(COMMIT|DROP|TRUNCATE|DELETE|UPDATE)\b/im);
  assert.match(sql, /phone_test_manual_posts_only/);
});
test('canonical identity has no membership or sharing fields', () => {
  const definition = sql.split('CREATE TABLE public.private_health_activities (')[1].split('\n);')[0];
  assert.match(definition, /UNIQUE\(user_id,source,external_activity_id\)/);
  assert.doesNotMatch(definition, /challenge_id|parent_workout_id/);
  assert.match(definition, /REFERENCES auth.users\(id\) ON DELETE CASCADE/);
});
test('RLS, narrow updates, consent and invoker-only own summary are explicit', () => {
  assert.match(sql, /ENABLE ROW LEVEL SECURITY/);
  assert.match(sql, /GRANT UPDATE\(steps\)/);
  assert.doesNotMatch(sql, /GRANT UPDATE ON/);
  assert.match(sql, /dc.is_active=true/);
  assert.match(sql, /SECURITY INVOKER/);
  assert.match(sql, /owner_id uuid/);
  assert.doesNotMatch(sql, /SECURITY DEFINER|CREATE TRIGGER|pg_publication|cron\.|net\./);
  assert.doesNotMatch(sql, /GRANT .* TO anon/);
});
