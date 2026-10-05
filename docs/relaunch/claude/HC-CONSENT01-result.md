# HC-CONSENT01 result (C02-R2 F1 only)

Base verified: 077c15e623790c08bb0321f135e2196f1a88a186, tree 05c6d5b04fd525276d4c2f6e19737e933956382e (read-only fetch; temporary detached worktree; existing node_modules symlinked, no installs). Leased paths only: src/hooks/useHealthSync.ts, tests/useHealthSync.test.ts, this file.

## Change
- Android `syncAndRecord`: after the first scope check, awaits the existing `hasActiveHealthConnectConnection(userId)` (unchanged), re-verifies scope, and only then calls `pollHealthConnect`. A lookup that throws (offline) propagates and nothing is polled or written. `false` (inactive or missing row) throws a generic "not connected" error, no typed result. Any non-`true` value is never treated as active. iOS path, typed partial errors, counts and the timestamp gate are untouched.
- On a confirmed `false` the hook reconciles only `health_connect` to inactive (current scope only, older in-flight fetches superseded). Unknown/offline results do not change state. No broadcast to other hook instances.
- `disconnect`: after the successful DB update and a scope check, the disconnected provider is marked inactive in this hook before local cleanup. A later cleanup failure is rethrown unchanged (no refresh runs, so it cannot be replaced by a refresh error) and the hook no longer shows "connected". Stale-account callers do not update state.
- connect/confirm: unchanged flow; the lookup follows the successful upsert, then the initial sync runs.

## Tests
Written first. Against the unchanged base, 15 of the new 20 tests failed (51 passed); after the fix all pass. New cases: cached-active vs inactive/missing server row (no poll, no status write, only Health Connect reconciled, other provider untouched); no second lookup after reconciliation; offline lookup; undefined result; active success (one lookup before the poll, count/timestamp unchanged); typed partial unchanged; account switch, A→B→A and unmount during a deferred lookup; stale inactive result not leaking into the new account; connect/confirm ordering (upsert < lookup < poll); connect with inactive lookup keeps success:true; disconnect cleanup failure (returned false and thrown), refresh error not replacing it, only that provider reconciled, switch during failing cleanup, successful disconnect still refreshes. The consent helper is mocked at the module boundary in this test file only (default true), so existing tests keep their meaning; its own tests are untouched.

## Results (actual, in the worktree)
- Targeted: `tests/useHealthSync.test.ts` 66 passed (before fix: 15 failed).
- Full `npx jest --runInBand`: 17 suites, 400 tests passed (382 accepted + 18 new in this suite; the 20 new test ids include 2 `it.each` cases).
- `npm run typecheck`: exit 0.
- Targeted eslint: 0 errors, 1 warning (the existing setState-in-effect warning, line moved).

## Limitations
- The lookup narrows the stale-cache window but is not atomic: a disconnect after the lookup, or an import already started by another hook/worker, is not cancelled. The later status write still requires `is_active=true`.
- Other hook instances (e.g. Profile) keep stale state until their next lookup; there is no cross-hook broadcast.
- Mocks only: no real RLS/database, device or scheduler evidence. F2–F8 are not addressed.
