# C02 review report (read-only, 5 tool turns used)

Everything below comes from reading source at HEAD 5adcf34. That is the code target plus handoff docs, and I did not diff against base. None of it is runtime evidence.

**Read:**
- `docs/relaunch/handoffs/C02-ready.md`
- `src/lib/healthConnectBackground.ts`
- `src/lib/backgroundSync.ts`
- `src/hooks/useHealthSync.ts`
- `plugins/withHealthConnectBackground.js`
- `plugins/health-connect-background/HealthConnectBackgroundModule.kt`
- `src/screens/ConnectDevicesScreen.tsx`
- `src/lib/healthConnect.ts`
- `src/contexts/AuthContext.tsx` lines 60-150
- `App.tsx` via grep only (lines 2, 11-12, 58-87)

**Unread:**
- `healthSyncIdentity.ts`
- `HealthConnectBackgroundPackage.kt`
- `app.json`, including the background manifest permission and plugin order
- all tests
- `ProfileScreen`
- migrations 001/002 and RLS policies
- `App.tsx` and the rest of `AuthContext.tsx`
- the `react-native-health-connect` library source

## Findings

**1. HIGH, worker ignores in-app disconnect. Known gap #4, but the code path is now confirmed.**
- **Location:** `src/lib/backgroundSync.ts:40-95`; `App.tsx:80-82` (`bootHealthSync`); `src/hooks/useHealthSync.ts:290-298`.
- **Reproduction:**
  1. Connect Health Connect with background granted.
  2. Disconnect. `is_active` becomes false, and `clearUserId` and `unregisterBackgroundSync` run.
  3. Force-stop and reopen the app. `bootHealthSync` calls `persistUserId` and `registerBackgroundSync` for any signed-in user.
  4. The worker only checks the persisted ID, the session and the background permission. It never reads `device_connections.is_active`.
  5. `pollHealthConnect` then imports workouts and steps, and the update at lines 89-93 sets `last_synced_at` on the inactive row.
- **Impact:** the user's data keeps importing after they disconnected. This is a consent and privacy problem.
- **Smallest fix:** in `bootHealthSync` and the worker, require an active `health_connect` row before persisting, registering or polling. Test: with `is_active=false`, the worker returns NoData and `pollHealthConnect` is not called.

**2. MEDIUM, sign-out race against the next account's registration.**
- **Location:** `src/contexts/AuthContext.tsx:95-99`.
- **Reproduction:** `signOut` fires `clearUserId()` and `unregisterBackgroundSync()` without awaiting them. If account B signs in and `bootHealthSync` (`App.tsx:80-82`) persists and registers before those resolve, B's ID can be cleared and B's task unregistered.
- **Impact:** background sync silently stops for B until the next launch. The failure is fail-closed, so nothing leaks, but sync is lost.
- **Smallest fix:** await both calls before `signOut` resolves. Test: delay the mocked `clearUserId` and sign in as B immediately afterwards.

**3. MEDIUM, unbounded `.in()` lookup can wedge the sync permanently.**
- **Location:** `src/lib/healthConnect.ts:245-257`.
- **Reproduction:**
  1. Reads allow up to 100 pages of 200 sessions each.
  2. All their external IDs go into one `.in('external_activity_id', externalIds)` filter.
  3. If PostgREST rejects an oversized request URL, the lookup throws, the poll fails, and the cursor never advances. Every retry hits the same window.
- **Impact:** a heavy user with many sessions after a long gap or on first run never imports. This is distinct from known gap #6, which covers writes. I have not confirmed the server's URL limit.
- **Smallest fix:** chunk the lookup (about 100 IDs per query). Test: 500 synthetic sessions produce chunked queries and still complete.

**4. MEDIUM, `last_synced_at` can be written without a row actually updated (false success). Related to known gap #5.**
- **Location:** `src/hooks/useHealthSync.ts:154-161`; `src/lib/backgroundSync.ts:89-94`.
- **Reproduction:** if the `device_connections` update affects zero rows (row missing, or blocked by RLS with no error), `error` is null. The foreground path then calls `setLastSynced` and returns success.
- **Impact:** the UI shows "synced" when nothing was recorded. The 30-minute staleness warning also depends on this column.
- **Smallest fix:** add `.select('provider')` to the update and require at least one returned row. Test: the mock returns `{data: [], error: null}` and the sync must fail.

**5. LOW-MEDIUM, steps-missing grant makes the background worker report Failed every run. Related to known gap #2.**
- **Location:** `src/lib/healthConnect.ts:322` and `:386-398`; `src/lib/backgroundSync.ts:71-73`.
- **Reproduction:**
  1. Grant ExerciseSession but not Steps.
  2. The poll returns `completed=false` with `ranWithPermissions=true`, so the worker returns Failed on every run.
  3. `last_synced_at` is never bumped even though exercise imports succeed.
- **Impact:** a permanent "no recent successful sync" warning, and the background fetch may be penalised for repeated Failed results. This contradicts the "exercise progress is permitted" behaviour in the handoff.
- **Smallest fix:** decide the semantics explicitly, for example treat missing Steps as a notice with exercise-complete, or document it as intended. Add a test for the worker with Steps missing.

**6. LOW, misleading staleness banner for users who never enabled background sync.**
- **Location:** `src/hooks/useHealthSync.ts:120-130`; `src/screens/ConnectDevicesScreen.tsx:224-244`.
- **Reproduction:** with background in the `permission_required` or `unsupported` state and no manual sync, `last_synced_at` goes stale after 30 minutes. The "No recent successful sync" warning then appears, even though no background sync was ever expected.
- **Impact:** false alarm that points users at the wrong recovery.
- **Smallest fix:** show the banner only when `backgroundAccess === 'granted'`.

**7. LOW, wrong message when the profile has not loaded.**
- **Location:** `src/hooks/useHealthSync.ts:219-220` with `ConnectDevicesScreen.tsx:56-60`.
- **Reproduction:** `useHealthSync(profile?.id ?? '')` passes an empty `userId` while the profile loads. `confirmHealthConnectConnection` returns false, and the screen alerts "Permissions were not granted" even though they were.
- **Smallest fix:** distinguish "not signed in" from "denied". Test: return from Health Connect settings with `userId=''`.

**8. LOW (device risk, unverifiable here), the background permission string depends on the library.**
- **Location:** `src/lib/healthConnectBackground.ts:7`, `:29`, `:42`.
- **Concern:** the code uses `recordType: 'BackgroundAccessPermission'` in both `getGrantedPermissions` and `requestPermission`. I did not read the library, so I cannot confirm the installed `react-native-health-connect` version maps this record type to `READ_HEALTH_DATA_IN_BACKGROUND`. If it does not, the state is always `permission_required` or the request is a no-op.
- **Check:** read the library's permission mapping, and confirm the manifest permission in `app.json`.
- **Kotlin:** `HealthConnectBackgroundModule.kt:17-31` looks consistent. It uses `SDK_AVAILABLE` and the feature status, and catches `LinkageError`.

## Known gaps, not new findings

Findings 1, 4 and 5 touch known gaps #4, #5 and #2 (new detail only). Known gaps #1, #3 and #6-#9 are untouched except for finding 3's distinction.

Nothing I read contradicts the handoff's account/identity-check design. `assertCurrent` and the per-user cursor key look sound on paper. This was a code read, so it does not prove isolation.

## Device and runtime evidence still required

- Natural background delivery with the screen locked.
- Reboot, force-stop and reopen.
- OEM battery restrictions.
- Permission revoke mid-run.
- Revoke followed by worker invocation.
- Old native build (module absent).
- A→B→A account switch with real RLS.
- Two supported phones.
- The Play background-permission declaration.

## Transport receipt (Codex)

Official local Claude Code / authenticated Pro; user confirmed Extra usage disabled.
Requested Sonnet/Medium, --max-turns 6, Read/Glob/Grep only. Successful response.
CLI reported numTurns=13; report says 5 tool turns. Do not claim the returned
turn count stayed at six; no retry or second review was launched.

