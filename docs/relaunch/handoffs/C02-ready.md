# C02 — combined Health Connect/background review

Task: C02
Master tasks: T02/T03
Mode: REVIEW
Repository: arnarjo/streakwar
Base commit: 4870123cb5a1640c0458b06e860af9b25ae1a078
Target commit: 2fd19dec38170889694cba09f46cbfe05f046713
Contract: NOT_REQUIRED (no new competition/data contract)

## Readiness and delivery

This is a concrete code-review target, NOT T02/T03 completion. T00/T01 native
arm64 debug compilation now passes; installation and device evidence is still pending. The packet explicitly permits C02 review
with listed device gaps. C01 was delivered; its cloud report is not imported.
The target currently exists only in Codex's local checkout, not GitHub or the old
Claude cloud checkout. Verify the exact target before reviewing. If unavailable,
stop and request a bundle/snapshot; do not review the old cloud source as current.

Writable scope: only `docs/relaunch/claude/C02-result.md` (create report).
Application code/tests/config/migrations: NONE. No agents, dependency installs,
network/service calls, credentials, cloud builds, pushes, PRs, merges or deployment.
Do not change CLAUDE_STATUS.md for this review; report delivery to Codex first.

## Review scope

Compare base..target, concentrating on:
- src/lib/healthConnect.ts and src/lib/healthSyncIdentity.ts
- src/lib/backgroundSync.ts and src/hooks/useHealthSync.ts
- src/lib/healthConnectBackground.ts and plugins/withHealthConnectBackground.js
- plugins/health-connect-background/*.kt and their plugin/capability tests
- src/screens/ConnectDevicesScreen.tsx and changed ProfileScreen sync UI
- tests/healthConnectPolling.test.ts, backgroundSync.test.ts, useHealthSync.test.ts
- app.json background permission/plugin changes; App.tsx and AuthContext.tsx as context
- migration 001/002 uniqueness and relevant ownership policies as read-only context

Do not repeat C01 configuration review or redesign the app. Trace failure paths,
not only happy-path mocks. Prioritize data loss, cross-account state, false
success and incorrect step totals. Distinguish confirmed bugs from device risks.

## Delivered behavior

Poll lock recovery, per-user cursors, paginated exercise reads, incomplete status
on failed reads/writes, verified duplicate recovery, aggregate-only steps, explicit
read-grant checks, reconnect task registration and failure banner. New account
checks occur at async write boundaries; hook scopes discard stale account state;
manual double taps reject; missing record grants produce a connection-screen notice.
Capability query uses native HealthConnectFeatures rather than an OS-version
guess; only an explicit user action requests optional background access.
Registration and every worker invocation fail closed unless supported/granted.
UI refreshes access on resume and ignores older status responses; scheduling
failure is separate from permission state. Foreground sync remains available.

## Checks run by Codex

- npm run typecheck: passed.
- npm test -- --runInBand: 163 tests / 10 suites passed, synthetic/mocked.
- ESLint: 0 errors / 63 warnings; diff whitespace check passed.
- npm run export:android: passed; Hermes Android bundle, NOT APK/AAB.
- npm run check:dependencies: passed against local SDK map, offline reliability warning.
- Native arm64 debug APK: passed, 579 tasks (30 executed), 19 seconds on cached
  toolchain; repeated prebuild, APK manifest and debug signature checked.
- No installation, native method invocation, natural background run or live DB/RLS test.

## Known limitations to keep distinct from new findings

1. Background declaration/request/capability path is now implemented and compiled,
   but runtime invocation, native interop, permission dialog and background delivery
   are unverified. Uses existing connect-client alpha with explicit experimental
   feature API opt-in. Play permission declaration/approval remains a release gate.
2. Steps-only operation is not implemented; missing Steps permits exercise
   progress but leaves aggregate completion false. Permission notice is local UI.
3. Identity checks cannot atomically cancel in-flight server/native/storage
   requests. Real RLS, A→B→A races and persisted background-ID lifecycle need review.
4. Background boot still persists identity/registers independently of current
   connection; disconnect/restart semantics and auth teardown races need review.
5. Zero-row updates, source collisions, current-day step correction to zero,
   edits/deletions and late records outside overlap are not solved comprehensively.
6. Reads are bounded at 100 pages of 200; writes are not yet bounded DB chunks.
   Individual retries on batch conflicts can be expensive.
7. Cold-start fetch errors have no dedicated UI. Some connect/disconnect/import
   overlap remains possible; guard checks are not a global operation transaction.
8. Arm64 debug native compilation passes; runtime/release/other ABIs and prior
   Doctor warnings remain unverified.
9. Preview/store-testing/production point to the same Supabase project. Never
   run fixtures/migrations there assuming it is isolated staging.

## Required result

At most eight prioritized findings with path/line at target, concrete reproduction
using synthetic data, observed vs expected behavior, impact, smallest correction
and suggested regression test. Separate known blockers from new findings.
List device evidence separately (screen lock, natural background, reboot,
restrictions, force-stop/reopen, two supported phones). Avoid saying the app is
ready or all account isolation is proven. Commit only the report if working in
an authorized review checkout; stop after delivery. Codex triages fixes.
