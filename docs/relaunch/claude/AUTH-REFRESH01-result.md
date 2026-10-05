# AUTH-REFRESH01 result (C02-R2 F3 only)

Base verified: 02459dd3f0f26fe9bd25a5c54fa58d8af55cdf3a, tree a15596856f8b4830e04a7b83b4e7406804cd6650 (scoped read-only fetch; new temporary detached worktree; existing node_modules symlinked, no installs). Lease: src/contexts/AuthContext.tsx, new tests/authRefreshNavigation.test.ts, this file. tests/authContext.test.ts needed no change (all its tests pass unchanged). RootNavigator untouched.

## Change
`AuthContext` keeps `resolvedUserRef`: the user whose profile result (row or authoritative absence) is applied. In the single synchronous auth callback, an event with a session for the SAME identity whose profile is already resolved is a quiet refresh: `session` still updates (new token), a profile refetch is issued with a new revision, but `loading` is not set, so `RootNavigator` (`if (loading)` blank) no longer unmounts the tree on TOKEN_REFRESHED, USER_UPDATED or repeated SIGNED_IN.
- Quiet refresh success replaces the profile. A transient failure (thrown error or any error other than PGRST116) keeps the valid current profile and `profileMissing`. Authoritative absence (PGRST116) clears the profile (no preservation) and `loading` stays false.
- Everything else is unchanged: first load and any identity change (A→B, A→null, A→B→A) clear the profile at once, set `loading`, and ignore stale responses via the revision/identity/unmount guards; a same-user event while the first load is pending still blocks (loading remains true, superseded response ignored). PASSWORD_RECOVERY, recovery-state clearing, lifecycle requests and purchases/reminder calls are unchanged. No awaited Supabase call was added to the callback and there is no new subscription.

## Tests (tests/authRefreshNavigation.test.ts, 17)
Real `AuthProvider` with a consumer gated like RootNavigator (loading → blank, reset flag, authenticated iff session && profile) whose children count mounts/unmounts and loading values per render. Covered: TOKEN_REFRESHED, USER_UPDATED and repeated SIGNED_IN (no blank frame, 0 unmounts, session token updates, refreshed profile applies); superseded refresh response ignored; thrown and returned transient failures keep the profile; PGRST116 clears without a blank frame; initial load blocks then mounts once; same-user event during pending first load keeps blocking; failed first load; A→B, A→B→A, sign-out, refresh in flight during identity change, unmount with a pending refresh; same-user recovery and cross-user recovery; callback stays synchronous.

**Before the fix** (unchanged base) 8 of these 17 failed (same-user events, transient-failure preservation, authoritative absence, recovery flag flow); the other 9 passed as regression guards. After the fix all pass.

## Results (actual, in the worktree)
- `authRefreshNavigation` + `authContext`: 39 passed.
- Full `npx jest --runInBand`: 18 suites, 420 tests passed (403 + 17).
- `npm run typecheck`: exit 0. Targeted eslint on the three files: 0 errors, 0 warnings.

## Limitations
- The consumer in the test mirrors RootNavigator's gating condition rather than rendering the real navigator with its navigation dependencies; it proves the provider no longer drives the blank/unmount path, not the final navigator behavior on a device.
- A pending first load still re-blocks on repeated events (by design). The quiet refresh is not cancelled by sign-out beyond the revision guard.
- Not addressed: other triggers that remount screens, device/token-refresh timing (the HC-return coincidence was a hypothesis), and F2/F4–F8.
