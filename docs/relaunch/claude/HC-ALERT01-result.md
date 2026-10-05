# HC-ALERT01 result

Base: f1c5a916bf4ff240224121d7ac0c30ea03251527. Leased paths only (both screens, healthSyncFeedbackScreens.test.ts, this file). healthSyncFeedback.ts and its tests untouched; HC-PARTIAL01-result.md preserved and uncommitted.

## Change
ConnectDevicesScreen and ProfileScreen each keep a `syncGeneration` ref bumped by a `useLayoutEffect` keyed on `profile?.id`: once on setup and once in cleanup. React runs the cleanup synchronously in the commit on an account change and on unmount, so the generation is invalidated with the lifecycle, not by a setState-in-effect. `handleSyncNow` captures the generation per invocation and, after `await syncNow()`, returns without an Alert in both the success and the catch branch if it changed. A->B->A therefore still suppresses (generation, not the latest id). Current-account Alert wording is untouched (same formatters).

## Tests (tests/healthSyncFeedbackScreens.test.ts)
- The auth fixture is now mutable (`mockAuth`); existing tests are unchanged except every `tree.unmount()` is wrapped in `act`.
- For both real screens, with deferred sync promises (no sleeps) and boxed invocations: success and typed partial error carrying A's counts after A->B; the same after A->B->A; the same after unmount; none shows an Alert.
- A sync started after the switch shows its own feedback and the stale one stays silent; same-account deferred success (including same-user re-renders), typed error and generic error still show the existing feedback.
- No React act warnings in the output.

## Results (actual)
- `healthSyncFeedbackScreens.test.ts`: 37 passed.
- Full `npx jest --runInBand`: 17 suites, 376 tests passed.
- `npm run typecheck`: exit 0.
- Targeted eslint on the three files: 0 errors, 4 warnings, all pre-existing in ProfileScreen.tsx.
- Mutations: removing the checks failed 14 tests; removing the cleanup bump (unmount/ABA) failed 4. Source restored.

## Limitations
Only the manual Sync Alert in these two screens is covered. Other async actions (connect, disconnect, background enable, OAuth, sign out) and other screens are unchanged. The sync itself is not cancelled; its result is merely not shown. The hook's own account guard and scheduling are untouched. Screen tests use faked React Native primitives, not a device.
