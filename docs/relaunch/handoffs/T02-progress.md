# T02 — Health Connect recovery and truthful sync status

## Claude preflight received

Same authorized cloud session:
https://claude.ai/code/session_01JJkjPxGJV5KhD9sFg8ZFFX

Claude reports commit `21d675bdf39222c0bff0d08e817cb1c84e97d058` on
`claude/c01-baseline-review`, containing only `docs/relaunch/claude/T02-preflight.md`.
Codex read the final handoff in Claude Desktop. This records its summary, not
an imported copy of the remote report/commit. Source tree checked by both sides:
`aa154bd16be32567c1f2a5bba84c5ef27e197018`, prior to this first runtime fix.
This TRIAGE assignment is not C02 or a native/device approval. No next cloud task
is running; Claude finished and stopped.

Candidate work from preflight: false last-success timestamps on failed imports;
existence-check errors and batch duplicates; shared cursor/account mismatch;
partial permissions; pagination; background registration after reconnect.
Validate each independently rather than treating the report as runtime evidence.
In particular, the report's claim that missing IDs reach insertion is too broad:
the current insertion filter already rejects missing metadata.id (the earlier
existence-check list can still contain the string "undefined").

## Implemented: always release the in-process poll lock

Previously `_pollInFlight` was set before initialization, permission checks,
AsyncStorage cursor reads and date conversion, but its `finally` covered only
the later import body. A rejected cursor read or invalid date left the flag true
and every subsequent call returned SKIPPED for the rest of that JS runtime.

The exported poll function now owns the lock in a `try/finally` surrounding the
entire unlocked operation. Original error propagation, skipped results, cursor
policy, import logic and HealthPollResult fields are unchanged. Recovery means
the next attempt is allowed; it does not repair a persistently corrupt cursor.
This lock is still module-local, not a cross-process synchronization guarantee.

## Evidence for the first lock fix (`e1440a2`)

- New regression test first failed on the original code: the retry was skipped
  after AsyncStorage rejection. After the fix the retry runs.
- Four mocked tests cover storage rejection, invalid cursor, synchronous native
  initialization error, and suppression of a concurrent overlapping call.
- Full suite: 69 passed / 6 suites. TypeScript: exit 0. Lint: 0 errors / 64
  existing warnings. Diff whitespace check: exit 0.
- Native module, AsyncStorage, database helper and Supabase client are mocked.
  Synthetic user ID and empty exercise data only; no network or live data calls.
- No dependency installation/update, Android build, device install or natural
  background execution was performed. Device model/Android version requested.

## Follow-up: success reporting and account-scoped cursors

- `HealthPollResult.completed` is distinct from permission availability. Failed
  reads, existence queries, inserts, step updates or cursor persistence cannot
  produce a successful completion result. A successful empty poll can.
- Foreground and background last-success timestamps now require completion;
  timestamp-write errors are checked too. Hook syncing state clears in `finally`.
  Connection/permission grants no longer manufacture a new sync timestamp.
  Manual-sync screens catch failures instead of displaying "Nothing new".
- Exercise cursors use `health_connect_last_sync:<userId>`. The old shared key
  remains untouched and is ignored because its owner cannot be established.
  Each account initially replays the existing seven-day lookback, then uses the
  existing 48-hour overlap. This is not a full historical backfill.
- Background sync checks persisted user ID against the authenticated session,
  including after refresh, and rejects auth errors. This is a start-of-task
  check, not cancellation or full isolation across mid-flight account changes.
- Step failures mark the overall result incomplete, but do not prevent saving
  the exercise cursor: today's steps are independently read again next time.

Verification: 90 tests in 8 suites; typecheck passed; lint 0 errors / 63 warnings;
`git diff --check` passed. New tests cover read/storage/step-write failures,
per-account cursor keys, session mismatch and auth failures, partial/skipped/
empty background polls, timestamp persistence, and hook connection/manual-sync
paths. The initial five success/cursor regressions failed before the follow-up
implementation. All service/native calls use mocks and synthetic data.

No native build, device execution, deployment, remote push or paid cloud job was
run for this follow-up. Claude's earlier preflight is not review of this diff.

## Next boundary

### Exercise pagination follow-up

ExerciseSession reads now follow continuation tokens with the same fixed time
window (200 records/page). Missing/null/empty tokens end pagination. All pages
are read before importing; a later read error, malformed page, repeated token,
or the 100-page safety limit leaves the cursor untouched and completion false.
The limit intentionally fails closed; very large windows need chunked/resumable
ingestion later. This does not change the raw Steps fallback or duplicate logic.

Evidence: four regression tests failed before implementation, then passed; an
additional test imports a synthetic exercise present only on page two. Full
suite: 95 tests / 8 suites. Targeted lint: no errors, two existing warnings.
Normal `npm run typecheck` is currently blocked by empty duplicate directories
under `node_modules/@types` (e.g. `react 2`, `jest 2`), left untouched. Diagnostic
TypeScript check explicitly selecting the 21 installed non-duplicate type
libraries passed; this does not replace restoring the standard check.

Installed SDK options/native adapter support pageSize/pageToken. Platform
reference: https://developer.android.com/health-and-fitness/health-connect/read-data
(checked 2026-09-30). No device or live-service execution occurred.

### Exercise duplicate recovery (2026-10-01)

On batch unique violation (`23505`), retry individual inserts. Count only
successful new inserts. For an individual unique violation, verify a saved row
with the exact user ID and external activity ID before treating it as handled.
Do not constrain that verification by source: migration 002 defines the unique
index across sources. Never overwrite existing rows. Missing/unreadable
duplicates and other failures keep the cursor unchanged while allowing other
rows in the retry loop to import. Non-unique batch errors are not retried.

Four regression cases failed before implementation. Six added tests cover
mixed existing/new rows, missing/error duplicate verification, individual
non-unique errors, non-unique batch errors, and query account/record binding.
All 101 tests / 8 suites pass; lint 0 errors / 63 warnings; diff check passes.
The diagnostic explicit-type-library TypeScript check passes; the standard
check still fails on the pre-existing duplicate type folders described above.
No SQL migration, live-service call, deployment or device test was performed.
Large windows may cause many serial calls on conflict; bounded database
batching/resumable import and real DB/RLS behavior still need validation.

### Native reconnection registration (2026-10-01)

Both direct native connection and Health Connect settings-return confirmation
now call the existing registerBackgroundSync helper after connection upsert and
user-ID persistence, before the foreground import. Previously disconnect
unregistered the task, but reconnect did not restore it until app/auth startup.
Denied permissions or failed connection persistence do not schedule new work.
The helper avoids re-registering an existing task and respects denied/restricted
background-fetch status. Its existing catch/log behavior is unchanged: this
patch does not expose registration failure to the UI or guarantee delivery.

Two reconnect regression tests failed before the fix. Ten added mocked tests
cover both reconnect routes, denied permissions, failed upserts, missing/existing
task registration, and denied/restricted background-fetch status. Full suite:
111 tests / 8 suites. Lint 0 errors / 63 warnings; diagnostic explicit-type-library
TypeScript check and diff check pass. Standard typecheck remains blocked by the
duplicate type directories documented above. No device, live data or paid job.
Scheduling options/dependencies were not changed. The 15-minute interval is a
hint, not a delivery promise (Expo BackgroundFetch documentation checked).

### Registration feedback follow-up

registerBackgroundSync now returns a boolean: false for denied/restricted
status or caught registration errors, true for existing/successful registration.
Both connection paths expose failure as backgroundSyncUnavailable without
blocking foreground import. Connect Devices renders an alert banner with manual
sync/reconnection guidance; the unconditional "auto-syncing" status is removed.
A later successful connection clears the warning, as does native disconnect.
This warning is local hook state: startup errors and failures discovered after
leaving the screen are not monitored/persisted by this change. True registration
does not establish actual background delivery or Health Connect read permission.

Seven assertions/cases failed before implementation. Full suite now passes
114 tests / 8 suites; lint 0 errors / 63 warnings; diagnostic explicit-type
TypeScript and diff checks pass. Standard typecheck remains blocked as above.
No device or visual UI test was performed, and no live services were called.

### Steps safety and explicit read grants

Exercise polling now requires ExerciseSession read access (write access is not
enough). Steps are attempted only with Steps read permission. Missing Steps
permission still permits exercise progress/cursor persistence but leaves overall
completion false; more precise per-type UI and steps-only mode are still pending.
Raw Steps summation fallback is removed: aggregation failure cannot silently
double-count overlapping phone/watch records. Negative, non-finite and non-number
totals are rejected. The aggregate API remains responsible for deduplication;
we have not demonstrated its native behavior on a device.

Six regression tests failed before implementation; all 120 tests / 8 suites now
pass. Standard typecheck is restored by relocating 21 verified-empty duplicate
type folders to `/private/tmp/streakwar-empty-type-folders-nsh5E8` (no deletion,
dependency changes or lockfile changes). Lint: 0 errors / 63 warnings; diff check
passes. Android guidance checked 2026-10-01:
https://developer.android.com/health-and-fitness/health-connect/read-data
No live health records or services were accessed.

### Combined pre-device checkpoint: identity, UI and permissions

- New assertHealthSyncUser checks current session ownership before polling,
  exercise batch/retry writes, step insert/update and cursor persistence.
  Foreground connection/disconnect and last-success writes check identity too;
  background checks again after import. This narrows races, not a replacement
  for server RLS or proof of atomic cancellation of already-dispatched requests.
- Hook scopes are invalidated on account change/unmount; old-account connection
  fetches and success state are discarded, local state resets on account change.
  Manual double taps reject, rather than showing an empty success; disconnected
  and signed-out manual sync reject too. Failed disconnect writes are surfaced.
- Permission checks consistently require read (not write) grants. Poll results
  identify missing ExerciseSession/Steps grants; Connect Devices shows guidance.
  Steps-only operation and a full per-type result model remain pending.
- 132 tests / 8 suites, standard TypeScript, lint (0 errors / 62 warnings), diff
  whitespace check pass. Android JS/Hermes export passes. Expo dependency check
  uses the local SDK map and warns validation is offline, not an online audit.
- Java runtime lookup still fails; adb/sdkmanager not found. No native binary,
  device installation, server integration, migration, payment or store actions.

Known high-priority blocker found in static inspection: app.json does not declare
READ_HEALTH_DATA_IN_BACKGROUND; the installed RN bridge maps the corresponding
permission but has no feature-status wrapper. Capability-gated native support,
manifest/request flow and compiled/device evidence still need work. Registration
with Expo alone does not establish permission to read Health Connect in background.

This is now a concrete C02 review target, with limitations explicitly listed;
the review is not an assertion that T02/T03 acceptance criteria are met.

Do not mark T02/T03 complete. Remaining work includes large-batch handling,
global/persistent registration status and richer per-type permission/status UI.
Exercise pages are now read,
but this is not proof that all historical records were read. Foreground stale state/in-flight account
changes, zero-row status updates and existing manual-sync early no-op returns
also need review. iOS import internals were not hardened or device-tested here.
Check installed SDK types and current official platform documentation before
changing native/background behavior; add failure-path tests before device tests.
C02 needs a concrete combined T02/T03 review target and an explicit list of
pending device checks. These incremental fixes are not that combined target.
# 2026-10-01 — native background capability checkpoint

Commit `2fd19dec38170889694cba09f46cbfe05f046713` adds a prebuild-persistent
HealthConnectFeatures bridge, background manifest permission and explicit
optional user request. Worker execution and registration check current feature
support and read grants; denied/unsupported access leaves foreground sync
available. Connection-screen state refreshes on resume without prompting and
rejects stale responses. Permission state is not scheduling/delivery evidence.

163 mocked tests / 10 suites, typecheck, Android export and arm64 debug native
build pass. Lint: 0 errors / 63 warnings. See `../LOCAL-ANDROID-BUILD.md` for
artifact hash and limitations. C02 target updated, not independently reviewed.
Physical-device background delivery, permission UI, new-architecture native
interop and isolated backend/RLS remain unverified; no release acceptance.
