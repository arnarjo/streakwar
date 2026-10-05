# HC-PARTIAL02B result

Base: e070cb30ae4c6f4f07319b6ed402a84708009bd1. Leased paths only; HC-PARTIAL01-result.md preserved and uncommitted. Not touched: healthConnect.ts, backgroundSync, lifecycle, batching, native, config.

## Implemented
- `src/lib/healthSyncFeedback.ts` (new, pure): `HealthSyncIncompleteError` (message keeps the "Sync did not complete" prefix, carries the poll result), `formatSyncSuccess`, `formatSyncError`, `formatConnectedSyncNote`, shared stale/label wording. A missing, negative or inconsistent per-type outcome falls back to the existing generic retry text; non-typed errors stay generic (no backend text).
- Hook: `syncNow` still returns `Promise<number>` and throws for incomplete sync. The typed error is created only after `assertCurrent()` succeeds. A completed Android poll returns `exercise.written` (Steps insert/update is not a workout); a completed poll without an ok exercise outcome fails safely before any timestamp write. iOS count unchanged. The combined `completed` gate and the `last_synced_at` write are unchanged; partial results write no timestamp. `connectNative` keeps `success:true` and reuses the detailed partial wording (never "recent workouts have been synced"); `confirmHealthConnectConnection` stays a boolean. No new state.
- Both screens' Sync handlers use the shared success/error formatters. Complete zero => "Sync complete" / "Health data checked. No new workouts imported." ("Nothing new" removed). Partial: exercise ok with n (0 allowed) plus Steps permission-missing (enable access) vs Steps failure (retry); exercise failure with committed rows states n saved; fully skipped is "Sync not completed" with no empty-scan claim.
- Stale warning in both screens: "No recent full sync" / alert that some data may still have imported and to check permissions, connectivity and background restrictions; the battery-optimization claim is removed. Android native timestamp labelled "Last full sync" (Connect Devices row and Profile); the shared row defaults to "Last synced" so Strava/iOS are unchanged.

## Tests
- New `healthSyncFeedback.test.ts` (26): formatter truth table, typed error, connected note, stale wording.
- New `healthSyncFeedbackScreens.test.ts` (17): real ConnectDevicesScreen and ProfileScreen rendered with faked hooks/RN primitives; pressing Sync/stale rows asserts the Alert calls for zero/new, typed partials, generic errors, stale text, per-provider labels.
- `useHealthSync.test.ts`: legacy completed mocks now carry the additive outcomes; 10 new tests (count excludes Steps, typed partial keeps counts and no timestamp, fail-safe on missing outcome, save failure, stale account never exposes the outcome, connect partial/stale, confirm boolean). No existing assertion weakened.

## Results (actual)
Full `npx jest --runInBand`: 17 suites, 356 tests pass. `npm run typecheck`: exit 0. Targeted eslint: 0 errors, 5 warnings, identical count/locations to the baseline files. Mutation check (count from `synced`, Profile handler not using the formatter) failed 5 tests; source restored.

## Limitations
- Android native `last_synced_at` still means the combined all-types gate, so exercise-only users still see the stale warning; only its wording is now accurate. Changing that gate is a later decision.
- Screen tests use faked React Native primitives, not a device. Background task outcomes and scheduling are unchanged and unverified.
- Alerts can still appear after an account switch for the old screen instance (existing behavior).
