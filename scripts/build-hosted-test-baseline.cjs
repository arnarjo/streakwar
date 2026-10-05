// Offline, stdout-only renderer. Never connects to a database or runs SQL.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../docs/relaunch/database');
const read = name => JSON.parse(fs.readFileSync(path.join(root, name), 'utf8'));
const m = read('live-schema-metadata-2026-10-05.json').metadata;
const d = read('live-schema-details-2026-10-05.json').metadata;
const columns = read('live-column-types-2026-10-05.json').columns;
const q = value => '"' + value.replaceAll('"', '""') + '"';
const literal = value => "'" + value.replaceAll("'", "''") + "'";
const allowed = new Set(m.tables.map(t => t.name));
if (allowed.size !== 22 || columns.length !== 161 || d.functions.length !== 20) throw Error('Unexpected catalog');
if (columns.some(c => !allowed.has(c.table_name) || c.identity || c.generated)) throw Error('Unsupported column');
const sql = [
  '-- TEST ONLY: vqizpuqmsykmhlyihyry. Reviewed catalog reconstruction, not production migration history.',
  '-- Default is a rollback-only rehearsal. A separate reviewed application step is required to commit.',
  'BEGIN;',
  "SET LOCAL statement_timeout = '60s';",
  "SET LOCAL lock_timeout = '3s';",
  'SET LOCAL search_path = pg_catalog, public, extensions;',
  `DO $guard$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p','v','m'))
      OR EXISTS (SELECT 1 FROM auth.users) THEN
      RAISE EXCEPTION 'Refusing non-empty database; never erase data to bypass this guard';
    END IF;
    IF to_regnamespace('streakwar_test_control') IS NOT NULL THEN
      RAISE EXCEPTION 'Test baseline already present';
    END IF;
  END $guard$;`,
  'CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;',
  'CREATE SCHEMA streakwar_test_control;',
  'REVOKE ALL ON SCHEMA streakwar_test_control FROM PUBLIC, anon, authenticated;',
  'CREATE TABLE streakwar_test_control.environment (project_ref text PRIMARY KEY, baseline text NOT NULL);',
  'ALTER TABLE streakwar_test_control.environment ENABLE ROW LEVEL SECURITY;',
  "INSERT INTO streakwar_test_control.environment VALUES ('vqizpuqmsykmhlyihyry','catalog-2026-10-05-v1');",
  // Read-only pg_sequences capture: integer, start/min/increment/cache 1,
  // max 2147483647, no cycle. No production current sequence value copied.
  'CREATE SEQUENCE public.daily_mission_templates_id_seq AS integer START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 CACHE 1 NO CYCLE;',
];
for (const name of new Set(d.enums.map(e => e.typname))) {
  sql.push(`CREATE TYPE public.${q(name)} AS ENUM (${d.enums.filter(e => e.typname === name).map(e => literal(e.enumlabel)).join(', ')});`);
}
for (const name of [...allowed].sort()) {
  const fields = columns.filter(c => c.table_name === name).map(c =>
    `  ${q(c.column_name)} ${c.sql_type}${c.default_expr ? ' DEFAULT ' + c.default_expr : ''}${c.not_null ? ' NOT NULL' : ''}`);
  sql.push(`CREATE TABLE public.${q(name)} (\n${fields.join(',\n')}\n);`);
  sql.push(`ALTER TABLE public.${q(name)} ENABLE ROW LEVEL SECURITY;`);
}
// Referenced PK/unique constraints must exist before foreign keys.
sql.push('ALTER SEQUENCE public.daily_mission_templates_id_seq OWNED BY public.daily_mission_templates.id;');
sql.push('REVOKE ALL ON SEQUENCE public.daily_mission_templates_id_seq FROM PUBLIC, anon, authenticated;');
sql.push('GRANT ALL ON SEQUENCE public.daily_mission_templates_id_seq TO service_role;');
for (const type of ['p', 'u', 'c', 'f']) {
  for (const c of d.constraints.filter(c => c.type === type)) {
    sql.push(`ALTER TABLE public.${q(c.table)} ADD CONSTRAINT ${q(c.name)} ${c.definition};`);
  }
}
const constraintIndexes = new Set(d.constraints.filter(c => ['p', 'u'].includes(c.type)).map(c => c.name));
for (const index of m.indexes) {
  if (!constraintIndexes.has(index.indexname)) sql.push(index.indexdef + ';');
}
// SQL-language functions resolve dependencies when defined.
const functions = [...d.functions].sort((a, b) => Number(b.name === 'workout_points') - Number(a.name === 'workout_points'));
for (const f of functions) {
  if (/\b(?:vault\.|net\.|cron\.)|https?:\/\//i.test(f.definition)) throw Error('Unexpected external dependency');
  sql.push(f.definition.trim() + ';');
  const signature = m.functions.find(x => x.name === f.name);
  if (!signature) throw Error('Missing function signature');
  const target = `public.${q(f.name)}(${signature.args})`;
  sql.push(`ALTER FUNCTION ${target} SET search_path = pg_catalog, public, extensions, pg_temp;`);
  sql.push(`REVOKE ALL ON FUNCTION ${target} FROM PUBLIC, anon, authenticated;`);
  sql.push(`GRANT EXECUTE ON FUNCTION ${target} TO service_role;`);
  if (['get_weekly_leaderboard', 'get_league_group_leaderboard', 'use_streak_freeze', 'workout_points'].includes(f.name)) {
    sql.push(`GRANT EXECUTE ON FUNCTION ${target} TO authenticated;`);
  }
}
for (const trigger of m.triggers) sql.push(trigger.definition + ';');
for (const p of m.policies) {
  const roles = p.roles.map(r => r === 'public' ? 'PUBLIC' : q(r)).join(', ');
  sql.push(`CREATE POLICY ${q(p.policyname)} ON public.${q(p.tablename)} FOR ${p.cmd} TO ${roles}${p.qual ? ' USING (' + p.qual + ')' : ''}${p.with_check ? ' WITH CHECK (' + p.with_check + ')' : ''};`);
}
// Never inherit source TRUNCATE/TRIGGER/REFERENCES grants or anonymous access.
// This new isolated environment is for authenticated synthetic testing only.
for (const name of [...allowed].sort()) {
  sql.push(`REVOKE ALL ON TABLE public.${q(name)} FROM PUBLIC, anon, authenticated;`);
  sql.push(`GRANT ALL ON TABLE public.${q(name)} TO service_role;`);
  const grants = [...new Set(d.grants.filter(g => g.grantee === 'authenticated' && g.table_name === name && ['SELECT', 'INSERT', 'UPDATE', 'DELETE'].includes(g.privilege_type)).map(g => g.privilege_type))];
  if (grants.length) sql.push(`GRANT ${grants.join(', ')} ON TABLE public.${q(name)} TO authenticated;`);
}
for (const table of ['profiles', 'device_connections']) {
  for (const privilege of ['SELECT', 'INSERT', 'UPDATE']) {
    if (d.grants.some(g => g.grantee === 'authenticated' && g.table_name === table && g.privilege_type === privilege)) continue;
    const cols = [...new Set(d.column_grants.filter(g => g.grantee === 'authenticated' && g.table_name === table && g.privilege_type === privilege).map(g => g.column_name))].sort();
    if (cols.length) sql.push(`GRANT ${privilege} (${cols.map(q).join(', ')}) ON TABLE public.${q(table)} TO authenticated;`);
  }
}
sql.push('REVOKE CREATE ON SCHEMA public FROM PUBLIC, anon, authenticated;');
sql.push(`DO $verify$ BEGIN
  IF (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r' AND c.relrowsecurity) <> 22 THEN
    RAISE EXCEPTION 'RLS table count mismatch';
  END IF;
  IF has_column_privilege('authenticated','public.profiles','total_points','UPDATE')
    OR has_column_privilege('authenticated','public.profiles','push_token','SELECT')
    OR has_column_privilege('authenticated','public.device_connections','access_token','UPDATE') THEN
    RAISE EXCEPTION 'Protected column grant regression';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_class c WHERE c.relnamespace='public'::regnamespace AND c.relkind='r'
    AND (has_table_privilege('authenticated',c.oid,'TRUNCATE') OR has_table_privilege('anon',c.oid,'SELECT'))) THEN
    RAISE EXCEPTION 'Unexpected bulk/anonymous privilege';
  END IF;
END $verify$;`);
sql.push("SELECT 'BASELINE_REHEARSAL_PASS' AS result;");
sql.push('ROLLBACK;');
module.exports = { render: () => sql.join('\n\n').replaceAll('\r\n', '\n') + '\n' };
if (require.main === module) process.stdout.write(module.exports.render());
