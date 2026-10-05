# HC-PARTIAL02A result

Base: 1a1f3b57651f23bc5cf5646bbf73b2c458b88228. Leased paths only (healthConnect.ts, healthConnectPolling.test.ts, this file). HC-PARTIAL01-result.md left untouched and uncommitted.

## Implemented (additive)
`HealthPollResult` gains optional `exercise {status, written, cursorAdvanced}` and `steps {status, written, updated}` (`'ok'|'skipped'|'failed'`). Every resolved `pollHealthConnect` result populates both, including the early skip returns (wrong platform, poll in flight, HC unavailable, missing Exercise permission). `SKIPPED` is now `skippedResult()`, so each call returns fresh objects.
- exercise: `ok` only if every eligible row resolved and the cursor save succeeded (empty and duplicate-only windows are ok/0); otherwise `failed`, keeping committed `written` (= `synced` minus the Steps insert). Missing permission or an early skip is `skipped`.
- steps: missing read grant = `skipped` (decided by `canReadSteps`, not by error text); phase not reached (earlier exercise-phase throw) = `skipped`; aggregate/insert/update/identity failure = `failed`; zero aggregate = ok/0/false; insert success = written 1; conflict update success = written 0, `updated:true`.
- Unchanged: `synced`, `completed`, `ranWithPermissions`, `missingPermissions`, thrown behavior, cursor movement, ordering, bounded lookups/inserts, dedupe, retry stopping, lock, identity and consent checks, no extra reads/writes.

## Tests (tests/healthConnectPolling.test.ts)
Existing assertions kept; five strict `toEqual` results gained the new fields. 15 new tests, synthetic fixtures, deferred promises, no sleeps: absent Exercise permission; exercise-only grant; Steps aggregate failure; partial exercise batch failure (120 rows, second batch rejected) with successful Steps; empty window; duplicate-only window; Steps insert; conflict update; update failure; non-conflict Steps insert failure; cursor save failure keeping counts; identity switch during the exercise phase (Steps unattempted); during Steps with total >0 (no Steps write); during a zero-total read (Steps ok/0, cursor still not advanced); simultaneous skipped poll returning independent objects.

## Results (actual)
- `npx jest --runInBand tests/healthConnectPolling.test.ts`: 64 passed.
- Full `npx jest --runInBand`: 15 suites, 301 tests passed.
- `npm run typecheck`: exit 0.
- eslint on the two source files: 0 errors, 2 pre-existing warnings (`Constants` unused, `require` import) in lines I did not touch.
- Mutation check: three deliberate source mutations made 5 new tests fail; source restored byte-for-byte.

## Remaining limitations
- A conflict update's `updated:true` means the call returned no error; affected rows are not verified by the existing API.
- `steps.status` after an identity change reflects whether Steps itself threw, so a switch after a zero-total read leaves Steps ok while exercise is failed.
- User-facing warning is NOT fixed: `completed` still means all types, so exercise-only users still see it. UI, background result and `last_synced_at` semantics are deferred to the next package.
- Unit tests only; no device or scheduler behavior verified. Already dispatched database writes are not claimed cancelled.
