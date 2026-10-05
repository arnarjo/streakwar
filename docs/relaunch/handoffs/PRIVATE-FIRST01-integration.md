# Private-first phone slice — 2026-10-05

Owner delegated policy choice; see `../PRIVATE-FIRST-CONTRACT.md`. This is a
bounded first-device slice, NOT full relaunch or production acceptance.

## Architecture and backend (Codex)

Claude PRIVATE-FIRST01 read-only review independently recommended a separate
canonical table: old follower policies expose null-challenge posts, and public
profile/achievement/leaderboard code also exposes derived health metrics.
New private table avoids that entire public trigger/aggregate path.

`supabase/tests/private-health-schema.sql` is an empty-test-only candidate,
**not an active migration**. It adds owner-only `private_health_activities`,
unique owner/source/external ID, narrow column grants, active Health Connect
connection requirements on INSERT/UPDATE and an invoker/RLS summary RPC with
owner_id. Historical reads and deletion remain possible after disconnect.
No challenge/parent fields, public effects, schedules, seeds or publication.
A test-only CHECK blocks old provider importers from writing `workout_posts`.
Do not apply that constraint to production; old clients/data need a separate plan.

Health Connect now uses only private storage, never active-challenge lookup or
public fallback. Exactly one daily Steps snapshot must update. New private-v1
per-user cursor cannot adopt legacy public-post progress. Native/database error
objects are not logged from polling because they can contain private row values.

## UI delivery and independent integration

Claude PRIVATE-SUMMARY01 base `a76e6fc7…`, HEAD
`d75b010681c76e6d16765da530178a992d1cd005`; original decoded diff **34715 bytes**,
SHA256 `f9fcfc0d0a384ef1a366784b9fdacb6e94530904f326d0eca6050e48baf5fbc1`.
All four paths checked against lease. Original report archived under `../claude/`.

Codex reproduced two additional failures: stale refresh handles after A→B→A and
after same-owner token change could initiate obsolete requests. Scope-object
identity now rejects both; both regressions pass unchanged. Card text contrast
improved. Home refreshes on focus/feed refresh; Connect refreshes after sync.
Card is Android-only, displays private personal points/imported-record count,
and explicitly says these do not contribute to public challenges/rankings/streaks.
Public profile, feed, leaderboard and recap calculations are NOT merged with it.

## Actual verification

- **484 Jest tests /19 suites PASS**, typecheck PASS.
- Seven Node baseline/private-schema contract tests PASS.
- Targeted lint including both integrated screens: **0 errors /10 warnings**
  (existing Health Connect and Home warnings; no new hook/card warnings).
- Android JS/Hermes export PASS (not an APK/device test).
- Personal Chrome, exact TEST `vqizpuqmsykmhlyihyry`: baseline + private candidate
  + synthetic acceptance inside BEGIN/ROLLBACK returned
  `PRIVATE_INTAKE_OWNERSHIP_DEDUP_POINTS_AND_NO_PUBLIC_EFFECTS_PASS`.
- Three active public challenges, A and B peers/follower: B cannot read/write/
  delete A's private data or insert for A. Independent same external ID works.
  Repeat insert rejects; Steps refresh/correction/repeat/deletion count once.
  Public posts, profile points, challenge scores, achievements, streak counters,
  milestones and weekly rankings are unaffected. Anonymous privileges denied.
  Old provider inserts (standalone/challenge) are rejected.
- Expanded SQL run verifies disconnected source cannot INSERT/UPDATE, own
  historical read/delete still works. Separate post-rollback query returned
  **0 public tables /0 auth users /0 marker schemas**.

The test-only candidate is uncommitted on Supabase. Explicit action-time approval
requested to provision the isolated schema/access rules; no approval assumed.
No production rows changed, no Expo cloud job, no store upload, no new charge.

## Remaining before device

Provision test baseline after approval; verify actual REST/auth settings and
public client key; configure isolated Expo profile; identify exact Android build.
No real native/background proof. Invalid/overlong native session quarantine,
provider deletions/corrections, private history/recap/streak UX, explicit sharing,
Strava/HealthKit migration and historical public score repair remain future work.
The candidate retains strict duration/step limits: invalid records fail visibly
and can hold exercise progress; no claim that this pre-existing issue is solved.

Skills used: Supabase for explicit privileges, RLS and query verification;
Supabase Postgres best practices for owner isolation and canonical unique keys.
