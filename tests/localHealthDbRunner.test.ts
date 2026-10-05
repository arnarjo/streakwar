import { buildInvocation } from '../scripts/test-local-health-db.cjs';

it.each([{ args: [] }, { args: ['--run', '--host=production'] }, { args: ['--url', 'postgres://remote'] }])('rejects non-explicit or extra arguments: %j', ({ args }) => {
  expect(() => buildInvocation(args, {})).toThrow('Explicit --run');
});

it('requires an explicitly supplied local password', () => {
  expect(() => buildInvocation(['--run'], { PGPASSWORD: 'inherited' })).toThrow('STREAKWAR_LOCAL_DB_PASSWORD');
});

it('fixes the endpoint and strips inherited routing and provider credentials', () => {
  const plan = buildInvocation(['--run'], {
    PATH: '/usr/bin', STREAKWAR_LOCAL_DB_PASSWORD: 'synthetic',
    PGHOST: 'production', PGPORT: '6543', PGDATABASE: 'live',
    PGSERVICE: 'remote', PGOPTIONS: '-c role=service_role', PGPASSFILE: '/secret',
    DATABASE_URL: 'postgres://remote', SUPABASE_SERVICE_ROLE_KEY: 'not-for-child',
  });
  expect(plan.command).toBe('psql');
  expect(plan.args).toEqual(['-X', '-w', '-v', 'ON_ERROR_STOP=1', '-f', expect.stringContaining('local-health-isolation.sql')]);
  expect(plan.env).toEqual({
    PATH: '/usr/bin', PGHOST: '127.0.0.1', PGPORT: '54322', PGDATABASE: 'postgres',
    PGUSER: 'postgres', PGPASSWORD: 'synthetic', PGAPPNAME: 'streakwar-synthetic-local-test', PGCONNECT_TIMEOUT: '5',
  });
});
