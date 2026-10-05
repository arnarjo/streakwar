# Database history reconciliation — audit checkpoint

Captured 2026-10-01 from `supabase_migrations.schema_migrations` on the authorized
shared/live project `uzstenhkngldkrwnsmku`. No application rows, auth users, health
records, Vault values or connection credentials were selected.

`live-history-2026-10-01.json` preserves all 28 recorded migrations and their
original statement arrays. It is an **inert audit archive**, not an approved
script to execute. It contains historical insecure grants, data transformations,
fixed seed IDs, cron scheduling and Vault-dependent encryption operations.
Never replay it on the live database. Pattern checks found no JWT/key/connection-
string/long-secret/email/URL literals; this is not a general secret-audit guarantee.

`history-comparison-2026-10-01.json` records per-entry statement-array SHA-256 and
comparison to the repository at ae7fcb4. Run the offline, read-only comparator:

```sh
node --test scripts/audit-migration-history.test.cjs
node scripts/audit-migration-history.cjs
```

The second command deliberately exits 1 while discrepancies remain. It does not
connect, execute SQL, modify files, or repair history. TOKEN_MATCH means token/text
agreement, not SQL semantic equivalence or a reproducible DB proof. The small
tokenizer preserves quoted bodies and ignores outer comments/spacing; it is not
a general PostgreSQL parser. Review differences rather than auto-reconciling.

## Confirmed comparison

- 18 entries match by normalized tokens, including both October security fixes.
- 010: historical live SQL used 30 minutes; local SQL uses 20 and includes a
  drop/recreate of the streak trigger absent from that historical entry.
- 011: historical seeds use Icelandic names/descriptions; local seeds use English.
- 019–021: same versions refer to different migrations locally and remotely.
- 022–024 and two June entries are absent locally.
- Local 019 and live 024 both named security_hardening also differ in content;
  renaming the local file alone cannot reconcile them.

Current live `update_streak_on_workout()` was independently queried and contains
a 20-minute duration threshold. Old 010 history is NOT proof production currently
uses 30 minutes. Later migrations/manual changes can supersede old definitions.
No streak/product rule was changed this turn.

## Next safe sequence

1. Compare latest recorded definitions with current schema metadata; preserve
   deliberate local-only changes separately instead of silently discarding them.
2. Prepare a distinct schema-only local baseline with cron/network/seed side
   effects disabled and synthetic encryption material. Inspect Vault setup;
   historical comments are not trusted provisioning instructions.
3. Provision isolated loopback DB. Docker and psql remain unavailable on PATH;
   pinned Supabase CLI is cached but is not a running database.
4. Replay only the reviewed local baseline, then run the guarded ownership suite,
   real synthetic upserts, trigger regressions and cross-account cases.
5. Reconcile the active migration layout only after that evidence. Do not run
   db push/reset/migration repair or replace live history from this archive.

Baseline reconciliation is not complete. No additional live schema/data changes
were performed in this checkpoint.
