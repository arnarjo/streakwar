const test = require('node:test');
const assert = require('node:assert/strict');
const { sqlTokens, compareHistory } = require('./audit-migration-history.cjs');
test('outer whitespace/comments do not hide changed SQL tokens', () => {
  assert.deepEqual(sqlTokens('-- note\nSELECT /* nested /* x */ ok */ 1;'), sqlTokens('SELECT 1'));
  assert.notDeepEqual(sqlTokens('SELECT foo bar'), sqlTokens('SELECT foobar'));
  assert.notDeepEqual(sqlTokens('SELECT 1'), sqlTokens('SELECT 2'));
});
test('quoted literals and function bodies remain exact', () => {
  assert.notDeepEqual(sqlTokens("SELECT 'a b'"), sqlTokens("SELECT 'ab'"));
  assert.deepEqual(sqlTokens("SELECT 'it''s -- literal';"), ['SELECT', "'it''s -- literal'"]);
  assert.notDeepEqual(sqlTokens('DO $$BEGIN -- a\nEND$$'), sqlTokens('DO $$BEGIN END$$'));
  for (const s of ["SELECT 'bad", 'DO $f$bad', '/* bad']) assert.throws(() => sqlTokens(s));
});
test('separates name collisions, content drift, remote and local-only entries', () => {
  const snapshot = { migrations: ['one','two','three','four'].map((name,i) => ({version:String(i+1), name, statements:['SELECT 1']})) };
  const report = compareHistory(snapshot, [
    {name:'1_one.sql',sql:'SELECT 1;'}, {name:'2_other.sql',sql:'SELECT 1'},
    {name:'3_three.sql',sql:'SELECT 2'}, {name:'5_five.sql',sql:'SELECT 1'}]);
  assert.deepEqual(report.rows.map(r=>r.status), ['TOKEN_MATCH','VERSION_NAME_COLLISION','CONTENT_DIFF','REMOTE_ONLY','LOCAL_ONLY']);
  assert.equal(report.replay_verified, false);
});
test('rejects duplicate or malformed remote and local versions', () => {
  const row = {version:'001',name:'one',statements:['SELECT 1']};
  assert.throws(()=>compareHistory({migrations:[row,row]},[]));
  assert.throws(()=>compareHistory({migrations:[{...row,name:'../escape'}]},[]));
  assert.throws(()=>compareHistory({migrations:[row]},[{name:'001_one.sql',sql:''},{name:'001_two.sql',sql:''}]));
});
