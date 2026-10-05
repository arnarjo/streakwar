# Live Supabase security checkpoint — 2026-10-01

Owner explicitly authorized correcting the project's Supabase configuration.
Verified target: Streakwar, `uzstenhkngldkrwnsmku`, eu-west-2, ACTIVE_HEALTHY,
Postgres 17.6.1.104. This is the shared/live environment, not staging.

## Confirmed and corrected: backend token RPC privileges

Four public SECURITY DEFINER functions, owned by postgres, explicitly granted
EXECUTE to anon and authenticated and contained no caller ownership/role guard:

- find_garmin_pending(text)
- get_device_connection_decrypted(text,text)
- update_encrypted_device_tokens(uuid,text,text,text,timestamp with time zone)
- upsert_encrypted_device_tokens(uuid,text,text,text,text,timestamp with time zone,boolean,text)

The first two return decrypted OAuth credentials; the latter two write credentials
for a caller-supplied user ID. Function definitions/ACLs were inspected, NOT live
tokens, Vault secret values or health records. No attempt was made to exploit
the functions or prove access using somebody's actual provider identity.
This establishes an authorization defect, not evidence that it was exploited.

Deployed oauth-callback and strava-webhook source use a service-role Supabase
client for the token RPC calls. Local mobile source has no direct calls to these
four RPCs. The production code differs from the repository; deployed source was
checked instead of assuming the local Edge Functions represent production.

First applied migration `20261001093330_restrict_device_token_rpc_execution`:
revoke EXECUTE from PUBLIC, anon, authenticated; explicitly retain service_role.
Four exact signatures, transaction, lock/statement timeouts and privilege
assertions. Function bodies, row policies, user rows, tokens and secrets unchanged.
No user data deletion, provider revocation/rotation or deployment was performed.

Verification after commit: all four functions return anon=false,
authenticated=false, service_role=true via has_function_privilege. Migration
history confirms success. Fresh security advisors contain no token-RPC findings;
anonymous definer warnings fell 20→16, authenticated definer warnings 21→17.
No real OAuth exchange/webhook or phone test was run, so end-to-end service
behavior is not claimed verified merely from retained privileges.

## Recovery and traceability

Before all four ACLs were:
`{postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}`.
The prior functions did not grant PUBLIC directly. Re-granting anon/authenticated
would recreate the exposure and is NOT an automatic rollback recommendation.
If a legitimate client is blocked, route it through an authorized backend rather
than reopening credential access. ACL recovery needs no row-data restore.
No full database backup/PITR availability was verified through these tools.

Created the file with official pinned Supabase CLI 2.119.0 `migration new` after
reading help. MCP assigned a later history version; the local file was renamed
to that exact applied version, not inserted as a second migration. No npm
dependency/lockfile or global shell configuration changed. CLI state directory
access was granted; no CLI account token was copied or login performed.

## Important migration drift — block blanket db push/reset

Local and live history match by version/name through 018 (SQL bodies have not
been proven identical at that initial checkpoint), then differ:

| Version | Local repository | Live project |
|---|---|---|
| 019 | security_hardening | encrypt_oauth_tokens |
| 020 | read_scoping | multi_challenge_workout_fan_out |
| 021 | global_challenges_english_and_fun | heart_rate_columns |
| 022 | absent | fix_streak_freeze_idor |
| 023 | absent | storage_bucket_policy |
| 024 | absent | security_hardening |
| 20260605000000 | absent | security_perf_followup |
| 20260605100000 | absent | device_token_rpcs |

Reconcile actual definitions and history before generating a reproducible local
baseline. Do not rewrite live migration history or push local 019–021 over it.
The new hotfix depends on functions not yet represented in the local baseline;
fresh local replay remains blocked until that baseline is reconciled.

Follow-up: all 28 migration statement arrays are now archived outside the active
migration directory, with hashes and an offline comparison. Earlier 010/011 also
differ in SQL content despite matching names. See `database/README.md` for the
actual comparison and side-effect warnings. Limited credential-pattern checks
found no secret literals; replay and complete schema reconciliation remain undone.
Do not treat the history inventory as a reproducible schema baseline.

## Second correction: device connection client writes

Applied and verified `20261001094527_restrict_device_connection_client_writes`.
Before: anon/authenticated/service_role each had table ALL privileges, including
INSERT/UPDATE on external_user_id, external_token_ref, token_expires_at and both
encrypted token columns. Ownership RLS limited rows, not editable columns.
Deployed strava-webhook resolves event.owner_id using the decrypted-connection
RPC: client-editable provider identity is therefore a routing trust-boundary
defect. No real provider ID or credential was read or used to demonstrate abuse.

After:

- anon has no table/column access.
- authenticated retains SELECT/DELETE under existing ownership RLS; INSERT only
  user_id/provider/is_active; UPDATE only those plus last_synced_at.
- A SECURITY INVOKER trigger with empty search_path permits same-key upserts but
  rejects client changes of owner/provider. Its check uses current_user, not JWT
  user metadata. No new client-callable RPC or SECURITY DEFINER was introduced.
- service_role retains all original table write privileges. Deployed backend
  token RPCs execute as postgres and are not blocked by the client-only guard.
- Table-wide SELECT deliberately remains for compatibility; owners can still
  read their encrypted token columns. Removing this requires separate client
  compatibility review. This is not a claim of complete credential isolation.

Evidence:

1. Transactional migration asserted exact column write allowlists, service-role
   writes and enabled RLS. Lock timeout 3s; statement timeout 15s.
2. Disposable TEMP table with synthetic UUIDs exercised the actual trigger as
   authenticated: reconnect/upsert passed; owner/provider changes raised 42501.
   Temp table dropped at commit. No rows added to auth/public application tables.
3. Post-commit catalog query confirmed every role/column grant and trigger config.
4. `supabase/tests/device-connection-write-plans.sql` passed live: EXPLAIN without
   ANALYZE allowed native upsert, disconnect and sync-status update plans; denied
   external identity UPDATE and token INSERT. No data statements were executed.
5. Fresh security advisors have no finding naming the new guard. Existing mutable
   paths, other definer RPCs, pg_net, daily_mission_templates and password warning
   remain; this is not a clean overall security audit.

No phone, PostgREST integration, live OAuth or webhook delivery test was run.
Source compatibility checked in useHealthSync, backgroundSync and
healthConnectionConsent; database planning is not end-to-end runtime proof.
No client source changes, provider rotations, engine upgrades or purchases.
Rollback must not restore unrestricted client credential writes. Diagnose the
specific legitimate operation and adjust its safe allowlist or backend path.

Column privilege approach follows the [Supabase column-security guide](https://supabase.com/docs/guides/database/postgres/column-level-security).

## Remaining review, not automatically approved fixes

- Review 13 mutable function search paths and remaining SECURITY DEFINER RPCs;
  do not indiscriminately revoke legitimate app leaderboard/freeze APIs.
- Device-connection write boundary corrected above; review remaining owner
  ciphertext reads, provider activation semantics, views, Storage and other
  exposed tables against actual app access and provider-secret boundaries.
- daily_mission_templates has RLS/no policy: may be intentionally backend-only.
- pg_net in public and disabled leaked-password protection remain advisor items.
  Do not move extensions or change a paid-plan setting blindly.
- Check available RPC access logs for suspicious token-function calls. Determine
  affected integrations and whether token rotation/reconnection is necessary;
  absence of findings in limited-retention logs is not proof of no prior access.
- Review backup/restore options before data-changing migrations. No destructive
  changes or production test fixtures are authorized by this checkpoint.
- Changelog reviewed: Sep 25 Postgres 15.19/17.11 upgrade has pgcrypto/index
  compatibility considerations. Inspected token writers use AES256; this does
  not prove all historical ciphertext uses AES. No engine upgrade performed.

References: [Function privilege guidance](https://supabase.com/docs/guides/database/functions),
[anonymous SECURITY DEFINER advisor](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable),
[upgrade notice](https://supabase.com/changelog/postgres-15-19-17-11-breaking-changes).
