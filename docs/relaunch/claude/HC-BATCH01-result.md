# HC-BATCH01 result

Archived Claude report through correction commit 3864569a5c3d89c25e8bea153ef2c173f46e6105.
See the Codex integration record for independent verification and acceptance.
The retained Jest-globals failure statement below describes the first cloud run:
Claude's final response and Codex's local rerun both confirm plain typecheck passes.

Base: c9c910f9d23cd9b85ebdbda05f3bb67b5ef3d357 (isolated snapshot, source a685098).

## Changed paths (all leased)
- src/lib/healthConnect.ts (modified)
- src/lib/healthConnectBatching.ts (new, pure helpers, no I/O)
- tests/healthConnectPolling.test.ts (15 original tests added in `bounded exercise batches`, +2 in the correction; 2 existing conflict tests updated for stop-on-first-failure)
- tests/healthConnectBatching.test.ts (new; correction adds comparison against the installed PostgrestClient URL)
- HC-BATCH01-result.md (this report)

## Behaviour
- IDs: only non-empty string `metadata.id` of *completed* sessions; deduplicated across pages. A completed record is kept even if an earlier duplicate was unfinished. `String(undefined)` is never queried.
- Lookup: `HC_LOOKUP_MAX_IDS = 100` and `HC_LOOKUP_MAX_FILTER_CHARS = 4000`. Cost per ID = 3 chars per UTF-8 byte (URLSearchParams escapes everything except alphanumerics and `*-._`, incl. `! ' ( ) ~`) + 9 for quotes and separator, plus 9 for `in.(`/`)` framing per batch. Tests compare plans with the real installed PostgrestClient URL (no network). Limits/sizes must be positive integers (RangeError otherwise). Every batch keeps `user_id` and `source` filters; results are aggregated before the missing set is computed. A single ID over the budget throws `HealthConnectIdTooLongError` -> caught by the poll's existing catch -> no writes, no cursor, `completed=false`.
- Insert: `HC_INSERT_MAX_ROWS = 50`, strictly sequential. `assertHealthSyncUser` runs before every lookup batch, every insert batch and every individual retry.
- 23505 (corrected): individual retry and exact-user duplicate verification apply to the affected batch only; existing rows are never overwritten. `synced` accumulates across batches.
- First failed exercise row or batch stops all further exercise writes (Steps sync is unchanged and still runs); cursor is not advanced and `completed` is not true. Earlier batches remain committed (no transaction claim); the next poll dedupes and retries.
- Not touched: Steps, step correction, scoring, time zones, account lifecycle.

## Verification
- `npm ci --ignore-scripts --no-audit --no-fund` ran once (exit 0).
- Targeted Jest `--runInBand` (2 suites): 74 pass. Full suite: 13 suites, 223 tests pass. `npm run typecheck`: exit 0.
- `npx tsc --noEmit --types jest,node`: exit 0. Plain `npm run typecheck` reports only TS2304/2593/2708 "Cannot find name 'it'/'expect'/'jest'" in tests/*, because tsconfig does not load jest globals (pre-existing; not changed since config is read-only). No errors in src/.

## Limits / open risks
- 4000 is a conservative budget for the filter value only, not measured against the real server/proxy URL limit; the estimator is checked against the installed PostgrestClient 2.103.0 serialization.
- Mocks only; no live Supabase or device checks.
- A failure at the identity check or lookup also skips the Steps sync in that poll (existing catch behaviour, unchanged).
- A batch failure after earlier successes leaves partial inserts by design.

## Delivery
Fix commit follows 3e9f002; incremental diff: `git diff 3e9f002 HEAD`.
