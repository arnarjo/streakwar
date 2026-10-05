HC-PARTIAL02B READY — truthful foreground sync feedback. IMPLEMENT.
Base cloud e070cb30ae4c6f4f07319b6ed402a84708009bd1. HC-PARTIAL02A accepted locally as 2b13bd7: 305 tests, typecheck, Android JS export pass; targeted lint 0 errors/2 existing warnings. Four extra lifecycle regressions only exist locally. Continue same approved snapshot, no upload.

Lease ONLY:
src/hooks/useHealthSync.ts
src/lib/healthSyncFeedback.ts (new shared pure formatting/error module)
src/screens/ConnectDevicesScreen.tsx
src/screens/ProfileScreen.tsx
tests/useHealthSync.test.ts
tests/healthSyncFeedback.test.ts (new)
tests/healthSyncFeedbackScreens.test.ts (new integration tests, if needed)
HC-PARTIAL02B-result.md (<=600 words).
Everything else read-only. Existing HC-PARTIAL01 report preserved.

Decisions:
1. Keep syncNow Promise<number> and throw behavior for incomplete/failed/skipped sync. Add a typed incomplete error carrying the Android poll result only AFTER assertCurrent succeeds. Preserve recognizable error message prefix "Sync did not complete". Never wrap identity/session/unmount failures as a usable result. Keep generic errors generic (do not leak backend text).
2. On a fully completed Android poll, return exercise.written instead of mixed result.synced; Steps insert/update is NOT a workout. Require per-type outcome for accurate counts: legacy mocks can be updated to the additive contract, but missing production outcome must fail safely, not invent a workout count. iOS keeps existing workout count semantics.
3. Shared pure formatter used by BOTH real screen Alert handlers for success and errors. Complete zero => "Sync complete" and "Health data checked. No new workouts imported." Never "Nothing new" merely because Steps isn't a workout. Partial with exercise ok: say exercise sync completed, show confirmed new workout count (0 allowed), then distinguish Steps read permission missing (enable access) from actual Steps failure (retry). Partial exercise failure with committed rows: "Sync incomplete", state n workouts saved and retry; never claim full success. Entirely skipped => not completed, do not claim a successful empty scan. Unknown errors => current safe generic retry guidance. Avoid claiming Steps changed after zero affected rows.
4. Keep combined completed and last_synced_at write gate EXACTLY as before. Do not write a successful timestamp for partial results. Do not alter backgroundSync scheduler outcomes, permissions, native code, batching, identity, lifecycle or database queries.
5. Correct timestamp labels for Android native health to "Last full sync"; shared DeviceRow labels must not falsely redefine Strava/iOS timestamps. Stale warning in BOTH screens: no full sync recorded recently; some data may still have imported; check permissions/connectivity/background restrictions. Remove unsupported claim that battery optimization is the known cause; Android does not guarantee an interval.
6. ConnectNative's initial-sync catch should reuse detailed partial feedback when safely current, while preserving success:true meaning connection saved; confirmHealthConnectConnection boolean remains permissions/connection only. Do not claim all recent workouts synced after a partial result. Avoid new state unless necessary; any new state must clear on account change/disconnect and ignore late results.

Tests: shared formatter truth table for full zero/new workouts, exercise-only permission, actual Steps failure, exercise partial writes, skipped and generic error. Hook verifies complete count excludes Steps; typed partial result retains counts; no partial timestamp write; completion save error does not report success; stale account rejects without exposing old outcomes; existing concurrency/consent/lifecycle tests preserved. Prove BOTH screen handlers use shared success/error formatting, preferably lightweight component/handler integration tests rather than source-string assertions. Synthetic fixtures only. No weakening existing assertions, dependencies or config changes.

Run targeted + full Jest --runInBand, standard typecheck and targeted lint. No agents/hooks/MCP/network/services/credentials/installs/new exports/paid jobs/push/PR/reset/publication. Commit leased paths only. Deliver exact incremental diff from cloud base restricted to leased paths, full HEAD, byte length/SHA256; gzip/base64 in ORIGINAL TOOL OUTPUT PAYLOAD_BEGIN/PAYLOAD_END only, never retype in final response. Report limitations and stop after delivery.
