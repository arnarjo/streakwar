const test = require('node:test');
const assert = require('node:assert/strict');
const configure = require('../app.config');
const base = require('../app.json').expo;
const env = require('../eas.json').build['phone-test'].env;
const originalEnv = { ...process.env };
test.afterEach(() => { process.env = { ...originalEnv }; });

test('normal configuration is unchanged', () => {
  delete process.env.EXPO_PUBLIC_APP_VARIANT;
  assert.equal(configure({ config: base }), base);
});
test('phone-test is separately installed and has no Firebase or OTA connection', () => {
  Object.assign(process.env, env);
  const result = configure({ config: base });
  assert.equal(result.android.package, 'is.streakwar.phonetest');
  assert.equal(result.name, 'StreakWar Test');
  assert.equal(result.scheme, 'streakwar-test');
  assert.equal(result.android.googleServicesFile, undefined);
  assert.equal(result.updates.enabled, false);
  assert.equal(base.android.package, 'is.streakwar.app');
  assert.ok(!result.plugins.includes('./plugins/withPlayStoreVerification'));
});
test('phone-test fails closed for production URL or missing/secret key', () => {
  Object.assign(process.env, env);
  process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://uzstenhkngldkrwnsmku.supabase.co';
  assert.throws(() => configure({ config: base }), /isolated TEST/);
  Object.assign(process.env, env);
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'sb_secret_invalid';
  assert.throws(() => configure({ config: base }), /publishable key/);
});
test('phone-test rejects inherited purchase configuration', () => {
  Object.assign(process.env, env);
  process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID = 'goog_invalid';
  assert.throws(() => configure({ config: base }), /purchase credentials/);
});
