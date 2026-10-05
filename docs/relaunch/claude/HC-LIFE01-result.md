# HC-LIFE01 result

Base: 3864569a5c3d89c25e8bea153ef2c173f46e6105 (isolated snapshot). Batching code untouched.

## Changed paths (all leased)
App.tsx, src/contexts/AuthContext.tsx, src/lib/backgroundSync.ts, src/lib/healthSyncLifecycle.ts (new), src/hooks/useHealthSync.ts, tests/healthSyncLifecycle.test.ts (new), tests/authContext.test.ts (new), tests/backgroundSync.test.ts, tests/useHealthSync.test.ts, HC-LIFE01-result.md.

## Design
- `healthSyncLifecycle.ts` is the only mutator of persisted identity, task (un)registration and HealthKit start/teardown. `requestHealthSyncOwner(id|null)` records the desired owner and bumps an epoch synchronously; work runs on one never-rejecting promise queue. In-flight operations settle (checking `isCurrent` after awaits and before side effects), cleanup then removes what they touched, and the LATEST owner starts. Rapid changes collapse. Same-owner repeats are no-ops (token refresh does not restart anything).
- Cleanup attempts every step (HealthKit teardown, clear ID, unregister) even if one fails; failure is remembered and retried on the next sign-out request. A failed startup is retried by the next request for the same owner. Android startup still requires the active in-app connection and background-capability check; nothing prompts.
- `AuthContext`: the single, synchronous auth callback now requests the lifecycle owner for every event (so any SIGNED_OUT cleans up) and no longer gates on profile loading. `signOut()` never rejects: on a returned or thrown error it alerts, returns `{ error }` and tears nothing down; on success it waits for the serialized queue instead of a second cleanup. Profile: cleared synchronously on identity change; responses and `finally` are ignored if a newer auth event, switch or unmount happened. PASSWORD_RECOVERY unchanged.
- `App.tsx`: boot/teardown effect removed. `useHealthSync`: persist/register, enable-background and disconnect go through the coordinator; stale users get an "account changed" error. `backgroundSync`: optional `isCurrent` guards; `unregisterBackgroundSync` now returns false on failure.

## Verification (actual)
- Full `npx jest --runInBand`: see round 2 below (supersedes earlier counts). `npm run typecheck`: exit 0. Targeted eslint on changed files: exit 0 (one pre-existing warning at useHealthSync.ts:124).
- Mutation checks: ignoring `isCurrent` fails 3 tests; removing queue serialization fails 5.

## Limits / open risks
- Orders local mutations only; already-dispatched DB requests are not cancelled and cross-account isolation is not claimed solved.
- Fresh launch with a signed-in user on Android without consent leaves a previous user's stale persisted ID (worker already fails closed on mismatch).
- Queue waits for in-flight native calls; a hung call delays cleanup and `signOut` resolution.
- iOS `initHealthKit` from the Connect button stays direct (permission prompt); a late callback after teardown is neutralised only by healthKit's per-user check.
- Purchases/notification calls in the auth callback and ResetPasswordScreen's direct `signOut` are unchanged (the latter now cleans via SIGNED_OUT). ProfileScreen ignores the new `{ error }` result; the failure is shown by an Alert.
- No device or live-service verification.

## Round 2 review fixes
1. Operations capture the owner epoch at enqueue time, so a disconnect queued for A is rejected after A -> B -> A.
2. `startOwner` reports real success; `false`, a throw or an interrupted start leaves setup incomplete and the next same-owner request retries (an interrupted A -> B -> A start is resumed). Successful refreshes remain no-ops. Non-consented users re-check consent on each same-owner request (known cost).
3. `disconnectHealthSyncBackground` reports a failed/false unregister (clear and unregister both still attempted) and marks cleanup retryable at logout.
4. PASSWORD_RECOVERY for a different signed-in account drops that identity (session, profile, in-flight response, health state, purchases logout) while keeping the reset UI and a synchronous callback; the recovery session is not adopted as a health owner. Recovery state clears on logout or an unrelated account.
New tests fail against the previous implementation (10 failures).
