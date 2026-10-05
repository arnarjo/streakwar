# C02-R2 received report

Verbatim rendered report text retrieved from the personal Chrome Claude session
on 2026-10-05. Markdown formatting is not the original file formatting.
Findings are reviewer claims; see the separate Codex triage before acceptance.

C02-R2 consolidated Health Connect review (read-only)
Target verification
git fetch of https://github.com/arnarjo/streakwar.git codex/streakwar-baseline went into FETCH_HEAD only (no checkout/reset/merge; local files untouched).
Commit 39b722babadcc84d1e7ed15846036b76215b4027 verified. Tree 72d0cb1f81e3d57b0d1d3619f4c3797320be1677 matches. The local-equivalent tree 82be9fcc… was not accessible and was not compared.
Everything below was read with git show at the target. Line numbers are target lines. No tests, builds or app code were run. This is source review, not runtime, RLS/database, APK or device proof.
Against my cloud HEAD a6830d5, target source differs only by a batching comment, two formatter guards and extra tests (diffed). The HC-BATCH01/LIFE01/PARTIAL02A/02B/ALERT01 code I delivered is what was reviewed.
Original C02 findings 1–8
#	Status	Evidence
1 worker/restart ignores disconnect	Partial	Fixed for startup, registration and worker (backgroundSync.ts:65,125,162). Foreground manual sync is not gated: see F1.
2 sign-out cleanup race	Fixed in source, mock-proven	Single queue (healthSyncLifecycle.ts:46-139), auth callback synchronous (AuthContext.tsx:165-225). Unbounded waits remain: F8. Real auth lock and device are unverified.
3 unbounded .in()	Fixed in source	healthConnect.ts:287-297, batching helper. The server URL limit is unverified. A different permanent stall exists: F2.
4 zero-row status = success	Fixed in source, mock-proven	useHealthSync.ts:161-170, backgroundSync.ts:93-103. Real RLS/update-policy behaviour after the live migration …094527 is unverified.
5 Steps-missing → permanent Failed	Open by decision	Semantics unchanged. Feedback is now accurate: F5.
6 stale banner for manual-only users	Partial	Wording no longer diagnoses battery. The banner still keys on last_synced_at alone (useHealthSync.ts:121-131).
7 profile-not-ready wrong message	Mitigated, unverified	Still false for empty userId (useHealthSync.ts:229), but RootNavigator.tsx:84 only renders screens with a profile. See F3 (remount).
8 background permission string	Unverified on device	Codex's library-mapping evidence is not re-read by me. app.json declares READ_HEALTH_DATA_IN_BACKGROUND. Compilation of a permission is not runtime behaviour.
Findings (prioritized)
F1: HIGH, blocks first safe phone test: manual sync from a stale screen imports after disconnect
Path:
useHealthSync.ts:134-139: no consent check before pollHealthConnect.
useHealthSync.ts:269: the guard uses the hook's in-memory connections.
useHealthSync.ts:288-308: disconnect.
healthConnect.ts:197-205: the poll has no consent check.
ProfileScreen.tsx:61,179,350: own hook instance, no refocus fetch.
RootNavigator.tsx:99,105: Main/Profile stays mounted under ConnectDevices.
Sequence: connect HC (both screens show connected) → Profile → "Manage" → ConnectDevices → Disconnect (DB is_active=false, local cleanup) → Back → Profile still lists the source → tap Sync.
Expected vs actual: expected is no Health Connect read or import. From source, the guard passes on stale state and the poll inserts exercise/Steps rows. The status update (.eq('is_active', true), :166) then returns 0 rows and the UI says "Sync incomplete", but the data is already imported.
Variant: if disconnectHealthSyncBackground fails after the DB update (:300), the hook throws before fetchConnections (:307) and keeps showing "connected" for a disconnected source.
Impact: consent/privacy on real health data, against a shared live Supabase project.
Smallest fix: in the Android branch of syncAndRecord, call the existing hasActiveHealthConnectConnection(userId) before polling, and refresh connections on false.
Regression: hook with active connections but a DB row is_active=false → syncNow rejects, pollHealthConnect never called, no inserts.
F2: HIGH, blocks release only: one rejected record stalls all later imports permanently
Path:
healthConnect.ts:308-313: duration is unbounded.
healthConnect.ts:326,351-357: any non-23505 batch error sets insertFailed, loses the whole batch and never tries later batches.
healthConnect.ts:437: cursor held.
supabase/migrations/019_security_hardening.sql:106-116: rejects duration_minutes > 1440 with P0001.
Sequence: 120 completed sessions; #70 spans 30 h (1800 min), so batch 2 (rows 51–100) fails with P0001.
Expected vs actual: expected is that other records import and the bad one is handled explicitly. Actual is that the 49 valid rows in batch 2 and all of batch 3 are never written. The cursor stays, so the window start stays at the old cursor minus 48 h and every later poll hits the same record.
Caveat: the live trigger is unverified (migration drift is documented in STATUS). The Steps row has a similar steps > 120000 rule, which only affects Steps.
Smallest fix needs an owner decision (skip, clamp or null the duration). Minimal safe form: pre-validate eligibility against the server limits and count the record as rejected without blocking the cursor, or isolate with per-row inserts after a non-23505 batch error.
Regression: the 120-row case above with a mocked P0001 for the long row.
F3: MEDIUM, blocks release only; can invalidate device-test results: every same-user auth event blanks the whole navigation tree
Path:
AuthContext.tsx:209-216: setLoading(true) for any event with a session, including TOKEN_REFRESHED/USER_UPDATED.
RootNavigator.tsx:80: returns a blank view, unmounting all screens.
ConnectDevicesScreen.tsx:55-76,101: loses awaitingHCReturn and its AppState listener.
useHealthSync.ts:62-66: throws "screen closed" for in-flight confirm/sync.
Sequence: tap Connect → Health Connect settings → return while Supabase emits TOKEN_REFRESHED → the confirm or sync in flight is rejected before :235 or before the status write.
Expected vs actual: expected is that the connection is saved and screens are kept. Actual (certain from source) is that the tree is unmounted and the user lands on the initial route.
Hypothesis: the refresh coincides with the HC return window (refresh timing not verified).
Fix: set loading only on initial/identity change.
Regression: same-user TOKEN_REFRESHED leaves loading false and children mounted.
F4: MEDIUM, release only (owner decision on scoring semantics): Steps corrections and late days are not reflected
Path: healthConnect.ts:369-390. The aggregate covers local today only, is written only if > 0, and COUNT_TOTAL ?? 0 sits at :384.
Sequence: a 09:00 poll stores 3000; Health Connect later aggregates 0 (source removed/corrected), so no write happens and 3000 stays. Late-synced steps for yesterday are never updated.
Expected vs actual: expected is a documented rule. Actual is a stale or under-counted row.
Hypothesis: a missing COUNT_TOTAL key would silently look like "ok, 0 steps"; verify the key on a device.
Fix: decide the rule first, then update only when a row exists or the aggregate differs.
Regression: aggregate 3000 then 0 → expected row value per the decision.
F5: MEDIUM, accepted limitation needing owner decision: exercise-only permission is permanently "incomplete"
Path: healthConnect.ts:367,442, useHealthSync.ts:144-147,121-131, backgroundSync.ts:77-79.
Sequence: grant ExerciseSession only. Exercises import and the cursor advances, but completed=false on every poll. Manual feedback is now accurate, the timestamp is never written, the stale banner appears, and the worker returns Failed each run.
Unverified: whether a scheduler penalises Failed.
Fix: choose semantics (separate Steps notice vs. combined gate). For the first phone test, grant both permissions or expect the banner.
F6: MEDIUM, owner decision: 48 h look-back and cursor persistence
Path: healthConnect.ts:190-194,234-237,439.
Sequence A: watch offline 3 days; polls on days 1–2 advance the cursor; a day-3 sync inserts day-0 sessions into HC → the window starts day 1 → never imported (silent loss).
Sequence B: disconnect, then reconnect weeks later. The cursor key survives disconnect, so the whole gap is backfilled (up to the 100×200 read cap), including old workouts after the user disconnected.
Fix: the owner decides look-back and reset-on-disconnect. One regression test for each.
F7: LOW, blocks release only: health permissions declared beyond use
app.json android permissions READ_DISTANCE/READ_ACTIVE_CALORIES_BURNED and the plugin list Distance/ActiveCaloriesBurned, while healthConnect.ts:38-42 requests only ExerciseSession and Steps.
Impact: Play health declaration and data-minimization risk.
Fix: align the manifest with actual reads (Codex-owned config); add a config test.
F8: LOW (hypothesis), accepted limitation: unbounded awaits inside the lifecycle queue
backgroundSync.ts:162 → healthConnectionConsent.ts:5-11 awaits Supabase without a timeout inside the single queue (healthSyncLifecycle.ts:89,101). If a request hangs, later logout cleanup, disconnect ops and signOut (AuthContext.tsx:112) wait behind it. Fetch timeout behaviour is unverified.
Fix: bound each step with a timeout and mark setup incomplete.
Regression: never-resolving consent lookup, then logout.
No failing path found in

Per-type outcome bookkeeping and counts, batching/duplicate recovery within a batch, first-error retry stop, identity checks around writes/cursor, A→B→A lifecycle ordering, stale screen Alert suppression, and feedback wording for missing outcome data. Reason: traced against source and tests only; this is not proof.

Device evidence checklist (none of this exists yet)
Install the exact target build; log in with a synthetic account only.
Grant both permissions, then exercise-only: record manual sync, stale banner, worker result.
Disconnect on ConnectDevices, return to Profile, tap Sync (F1).
Background permission dialog and getHealthConnectBackgroundState truth; lock-screen delivery; reboot; force-stop; OEM battery limits; revoke mid-run.
Return from HC settings across a token refresh (F3).
A→B→A on one phone; sign-out with the task registered.
Long session (>24 h) and 120-record window (F2); a late-synced older record (F6); Steps corrected downward (F4).
Coverage gaps
Tests lack: foreground consent check, >1440-minute record, same-user TOKEN_REFRESHED loading, two hook instances, Steps corrected to 0, and cursor reset on disconnect.
All database and RLS behaviour is mocked; live schema drift means migration 019 is not confirmed.
Native bridge and manifest are compile/JS-export evidence only (the last APK evidence predates the target).
Unread scope

healthKit.ts and the iOS path, test bodies (names and diffs only, except the listed lines), purchases/push code, other migrations and RLS beyond 001/002/019 excerpts, react-native-health-connect source, withPlayStoreVerification.js, withHealthConnectMainActivity.js, live Supabase, build config.

This report does not declare T02/C02 complete or the app ready.
