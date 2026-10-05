# Isolated health database test preparation

Status 2026-10-01: runner and SQL prepared; SQL NOT EXECUTED. No docker, psql
or Supabase CLI found on this machine's PATH. Passing Jest tests exercise the
runner's argument/environment guards, not PostgreSQL or RLS.

The owner supplied dashboard project `uzstenhkngldkrwnsmku`; that is the same
project configured by EAS preview/store-testing/production. It is NOT staging.
Do not use its SQL Editor, credentials, data or service-role key for this test.

## Provisioning gate (not performed)

1. Provision a fresh, disposable local Supabase stack, bound only to loopback.
   Confirm 127.0.0.1:54322 is that stack, not an SSH tunnel/proxy to a real DB.
   No production dump, secrets, external webhooks, email/provider calls or real
   health data. Disable external egress, scheduled jobs and Edge Functions.
2. Reconcile a separate reviewed local baseline BEFORE applying any migrations.
   The repository chain is not currently replayable as an authoritative baseline:
   010/011 differ from history, 019–021 collide, and five remote entries are absent.
   See `database/README.md`; its historical JSON archive is NOT a runnable seed.
   Migrations 012/016 schedule cron jobs; full replay compatibility is NOT established.
   Supabase config references a seed file; provisioner must explicitly inspect
   or disable seeding rather than assume it is harmless/present.
3. Only after independently verifying the instance is disposable/local, mark its
   database with `ALTER DATABASE postgres SET streakwar.test_environment =
   'synthetic-local-only';` and reconnect. Never mark a hosted/shared database
   or empty an existing database merely to get past the test guard.
4. Supply the local-only password via `STREAKWAR_LOCAL_DB_PASSWORD`, then run
   `npm run test:db:local -- --run`. No URL/host overrides are accepted. Runner
   strips inherited PG routing/provider variables and disables psql startup files
   and interactive password prompts. Connection/statement/process timeouts apply.

The marker and empty-auth check are safety checks, not cryptographic isolation.
The operator must verify the local server and its trigger definitions first;
rollback does not undo arbitrary external side effects from custom triggers.

## Prepared assertions

`supabase/tests/local-health-isolation.sql` uses two synthetic users with
example.invalid addresses, no challenges/follow relationship, and one transaction.
It checks owner access/update, cross-user insert/read/update/delete boundaries,
anonymous reads, duplicate external IDs for one user and reuse by another user.
The same-user/cross-source collision test characterizes migration 002, not a
decision that the future ingestion contract should keep that behavior.

Expected RLS role changes run as authenticated/anon, not superuser/service role.
Fixtures and trigger-produced DB rows roll back at the end; ON_ERROR_STOP and
process exit close/roll back on errors. No migration/deployment/reset command
is part of the runner. Failing SQL may reveal either a real policy bug or a test
fixture assumption: inspect before changing policies or weakening assertions.

Next evidence must include migration versions, exact app/test commits, full SQL
result and rollback verification. This suite does not test JWT issuance, REST
transport, race atomicity, scoring contract, provider consent or phone behavior.

References: [Supabase database/RLS testing](https://supabase.com/docs/guides/local-development/testing/overview)
and [psql execution options](https://www.postgresql.org/docs/current/app-psql.html).
