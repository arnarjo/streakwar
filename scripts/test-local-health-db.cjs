/* global __dirname */
const { spawnSync } = require('node:child_process');
const path = require('node:path');

function buildInvocation(argv, env) {
  if (argv.length !== 1 || argv[0] !== '--run') {
    throw new Error('Explicit --run required. Only an empty, marked, disposable local Supabase database is allowed.');
  }
  if (!env.STREAKWAR_LOCAL_DB_PASSWORD) throw new Error('STREAKWAR_LOCAL_DB_PASSWORD is required; never supply a hosted database password.');
  return {
    command: 'psql',
    args: ['-X', '-w', '-v', 'ON_ERROR_STOP=1', '-f', path.join(__dirname, '../supabase/tests/local-health-isolation.sql')],
    // Do not inherit PGHOST/PGSERVICE/PGOPTIONS/PGPASSFILE/DATABASE_URL or provider keys.
    // Fixed loopback is a guard, not proof against a user-created SSH tunnel.
    env: {
      PATH: env.PATH || '/usr/bin:/bin',
      PGHOST: '127.0.0.1', PGPORT: '54322', PGDATABASE: 'postgres', PGUSER: 'postgres',
      PGPASSWORD: env.STREAKWAR_LOCAL_DB_PASSWORD,
      PGAPPNAME: 'streakwar-synthetic-local-test', PGCONNECT_TIMEOUT: '5',
    },
  };
}

if (require.main === module) {
  try {
    const invocation = buildInvocation(process.argv.slice(2), process.env);
    const result = spawnSync(invocation.command, invocation.args, {
      env: invocation.env, stdio: 'inherit', timeout: 60000,
    });
    if (result.error) throw new Error(`Local database test did not complete: ${result.error.code}. No automatic retry.`);
    process.exitCode = result.status ?? 1;
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
module.exports = { buildInvocation };
