// Explicit, reproducible environment for local Expo/Gradle commands. The key is
// publishable, not a service-role secret. Never load local .env production values.
const { spawnSync } = require('node:child_process');
const profile = require('../eas.json').build['phone-test'];
const [command, ...args] = process.argv.slice(2);
if (!command) throw new Error('Usage: node scripts/phone-test.cjs <command> [args...]');
const result = spawnSync(command, args, {
  stdio: 'inherit',
  env: { ...process.env, ...profile.env, EXPO_NO_DOTENV: '1' },
});
if (result.error) throw result.error;
process.exit(result.status ?? 1);
