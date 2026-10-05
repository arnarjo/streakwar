# Isolated hosted rehearsal — 2026-10-05

Target: **StreakWar-test**, `vqizpuqmsykmhlyihyry`, verified in the owner's
personal Chrome Supabase dashboard before execution. NOT production
`uzstenhkngldkrwnsmku`. No production rows or provider records were used.

## Reproducible inputs

- `scripts/build-hosted-test-baseline.cjs` renders a rollback-only baseline
  from the captured catalog, definition and exact-column-type JSON files.
- `supabase/tests/hosted-baseline-rehearsal.sql` is its checked-in output.
- Insert `supabase/tests/hosted-health-characterization.sql` immediately
  before the baseline's final `ROLLBACK` to reproduce the characterization.
- Both scripts are **test artifacts, not deployable migrations**. Do not
  remove the empty-database guards, replace ROLLBACK with COMMIT, or execute
  against production. The private marker is a guard, not proof of host identity.

The baseline reconstructs 22 public tables, 20 non-credential functions,
constraints/indexes/triggers/policies, explicit restricted grants and a fresh
owned integer sequence. All public tables and the private marker have RLS.
No production data, sequence values, schedules, seeds, provider credential
functions, webhooks, storage bucket, or Edge Functions are copied.

## Actual dashboard execution

Initial sequence dependency error was corrected in the renderer using read-only
catalog metadata; no persisted partial deployment. Standalone baseline returned
`BASELINE_REHEARSAL_PASS`. Two-user characterization then returned:

`OWNERSHIP_SOLO_PASS; MULTI_CHALLENGE_COLLISION_AND_DOUBLE_POINTS_REPRODUCED`

A separate read-only query after rollback returned public tables **0**, auth
users **0**, marker schemas **0**. Synthetic users had example.invalid emails
and no password/login credentials. They existed only in the transaction.

Following the client correction, the expanded transaction returned:

`OWNERSHIP_SOLO_AND_CLIENT_UPDATE_PASS; OLD_COLLISION_AND_DOUBLE_POINTS_REPRODUCED`

The separate post-test check again returned **0 / 0 / 0** after this expanded run.

Verified: signup triggers; own connection upsert/status update; solo exercise
and Steps insert/update; another user cannot read/write standalone health rows;
same external ID is independent per user; protected columns reject writes;
anonymous health-table access denied; invalid duration rejected.

The corrected Steps query updates two existing HC copies, preserves two distinct
challenge IDs, and leaves a synthetic Strava row with the same external ID at
1000 steps. It does not prove REST count headers, native delivery or phone UX.

## Remaining blockers

- Current fan-out gives global points for every challenge copy: reproduced
  total **21 = 9 + 6 + 6**, not the one-activity total. Correcting the client
  collision does **not** correct this scoring defect.
- Parent deletion uses `ON DELETE SET NULL`; adding only a parent-null points
  filter is insufficient. Insert/update/delete, rankings and achievement
  aggregation need one coherent activity identity/scoring contract.
- Imported-data sharing policy is awaiting the owner's choice. No sharing
  behavior has been expanded or redefined in this checkpoint.
- Test schema remains uncommitted; email-auth settings and API/client routing
  are unconfigured. Existing EAS profiles still target production and must not
  be used for the isolated phone test.
- No new APK, device install, real Health Connect or background proof.

Client review is integrated in HC-CATALOG02. Next: settle sharing/canonical scoring, verify corrected
backend transaction, explicitly provision test-only baseline, configure isolated
Android Expo profile and public key, then produce an exact phone-test build.
