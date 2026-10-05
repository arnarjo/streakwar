# Current catalog reconciliation — 2026-10-05

Read-only SQL transactions through owner's personal Chrome on production
uzstenhkngldkrwnsmku. No application/auth/health rows selected or changed.
Queries and outputs captured in live-schema-metadata and live-schema-details
JSON. These are inert evidence, NOT runnable baseline scripts. The latter
excludes the four OAuth token RPC bodies; no Vault values or cron commands read.
Source review by Claude archived at ../claude/DB-BASELINE01-result.md.

Observed: 22 public tables, all RLS enabled; 161 columns, 54 policies, 60 indexes,
13 application/auth triggers, 24 non-extension functions (20 bodies inspected
for network/credential references and captured), 72 constraints. No public-table
publication membership returned. RLS enabled is not a policy correctness proof.

## Confirmed differences relevant to the first phone test

- Workout uniqueness is NOT local migration 002's (user_id, external_activity_id).
  Live partial indexes include source and challenge_id, with a separate
  no-challenge key. Multiple challenge copies for the same external ID are valid.
- fan_out_workout_to_challenges is active and creates copies linked through
  parent_workout_id. Its `cp.challenge_id != NEW.challenge_id` excludes all rows
  when NEW.challenge_id is NULL (SQL NULL comparison); this is current behavior.
- Health Connect duplicate verification uses maybeSingle without challenge/parent
  qualification. At this captured base its Steps update matches user/external ID
  (NOT source) and sets every
  matched row to one challenge_id. With multiple copies this can hit uniqueness
  conflicts. Reproduce in an isolated SQL test before accepting a correction.
- Current award_global_points_on_workout unconditionally adds workout_points
  and has no parent_workout_id guard. Fan-out rows fire the same insert trigger.
  Potential multi-challenge point multiplication must be tested; no claim about
  actual affected user rows is made because none were read.
- Current validation, step-delta and delete-compensation triggers do exist.
  Claude's uncertainty about their existence is resolved by this capture.
- History vs current streak threshold was already resolved as 20 minutes in
  the earlier checkpoint; do not revive historical 30-minute SQL as a rule.

## Safe provisioning boundary

Do not execute the repo chain or copy all historical/default privileges. Captured
ACLs include broad privileges that need review, not blind reproduction. Build a
separate reviewed schema-only baseline, no cron/seeds/OAuth/network/real data.
First phone scope: synthetic Health Connect + email auth, no real public challenges
or purchases. Keep multi-challenge cases in rollback-only synthetic DB tests.
Preserve existing loopback-only test guard; hosted tests need a separate exact
test-project guard (vqizpuqmsykmhlyihyry). TEST is still empty, no schema deployed.

Next: reproduce the import/index mismatch; reconcile all exact column types,
grants, function/trigger dependencies and auth configuration; then test-only
provisioning and RLS assertions. Only then wire the app and build an exact APK.
No production rule change or release/phone readiness is implied.
