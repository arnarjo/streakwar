# PRIVATE-SUMMARY01 result

Base `a76e6fc748442c8e50d975e6f157bb14fc2368a6` (tree `612533d6…` verified, new detached worktree, scoped fetch). Only leased paths changed; no HC/backend/Home/Connect files touched.

## Delivered
- `src/hooks/usePrivateActivitySummary.ts` — `usePrivateActivitySummary(userId, refreshToken?)` → `{ status: idle|loading|ready|error, summary, refreshing, refresh }`. Calls `supabase.rpc('get_my_private_activity_summary')` with no arguments. Read-only; logs nothing.
- `src/components/PrivateActivitySummaryCard.tsx` — props `userId`, `refreshToken?`. Title "Private Health Connect activity", notice "Only you can see this. Not included in challenges, leaderboards or streaks yet.", "Personal points", "Imported records" (never "workouts"). States: loading, empty (Connect Health Connect text, no navigation), error with Retry, ready with Refresh (disabled while refreshing). Accessible labels on both buttons. Existing `C` theme. Returns null when `userId` is empty.
- `tests/privateActivitySummary.test.ts` — 50 tests (real hook and card, mocked Supabase/RN primitives, deferred promises, no sleeps, console spies assert no logging/warnings).

## Behavior contract
- Accepted only: array with exactly one row, `owner_id === userId`, three counters that are non-negative safe integers, as numbers or strict decimal strings (`^(0|[1-9]\d*)$`). Everything else (rpc error, throw, null, wrong shape, owner mismatch, negative, fractional, exponent, padded, unsafe, NaN/Infinity) is a retryable error, never zero success. An error drops previously shown numbers.
- State is stored with its owner and requested token. A different `userId` hides the old summary in the same render. Each request has a sequence number; user/token change, a newer refresh and unmount/logout invalidate older ones (including ABA and responses that arrive after logout). A handle from an old account cannot start a request.
- Same owner + new `refreshToken` or manual refresh keeps that owner's good summary visible with `refreshing: true`.
- `total_steps` is validated and exposed by the hook but not displayed (daily Steps snapshots would mislead).

## Verification (in the worktree)
- Full Jest `--runInBand`: 19 suites, 478 tests pass (428 base + 50 new).
- `tsc --noEmit`: exit 0. `eslint` on the three leased files: exit 0, no warnings.
- Mutation checks (restored byte-for-byte): removing the sequence check, the owner check, the owner-hide, or the cleanup invalidation each makes tests fail.

## Not verified / notes
- The RPC does not exist in this snapshot; behavior against the real function, RLS and `auth.uid()` is unproven (mocked only).
- No device or screen-integration evidence; Codex supplies `refreshToken` and placement.
- Card uses `toLocaleString('en-US')` for numbers.
