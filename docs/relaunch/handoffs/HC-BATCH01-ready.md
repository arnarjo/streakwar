# HC-BATCH01 — implement bounded Health Connect database batches

Mode: IMPLEMENT, supplemental correction to C02 finding 3 / T02.
Original repository: arnarjo/streakwar, source commit a685098.
Transport: dedicated source-only snapshot, one initial commit, no original Git
history, credentials, backend migration archive or deployed-service configuration.
The snapshot's manifest identifies original source hashes. No GitHub push/PR.
Contract: NOT_REQUIRED; preserve current data model and scoring semantics.

Codex explicitly leases these paths to Claude for this one task:
- src/lib/healthConnect.ts
- src/lib/healthConnectBatching.ts (optional new pure helper)
- tests/healthConnectPolling.test.ts
- tests/healthConnectBatching.test.ts (optional new test)
- HC-BATCH01-result.md (new report, <=600 words)

All other files read-only, including dependencies, config, background sync, auth,
UI, native code and database schema. No agents, hooks, MCP, skills, live service
calls, device/cloud builds, store actions, resets, deployments or purchases.
Do not touch real accounts or exercise data. Do not print environment values.
Work only in this disposable snapshot. Codex reviews and integrates the patch.

## Implement

pollHealthConnect already reads up to 100 native pages of 200 sessions, but sends
all external IDs in one .in() and all new rows in one insert. Fix only that.

1. Deduplicate valid session IDs; never query literal 'undefined' or 'null'. Keep
   existing behavior of ignoring missing IDs and unfinished sessions. Avoid losing
   a completed record when an earlier duplicate of its ID is unfinished.
2. Bound lookup requests by count AND conservative encoded-filter length; choose
   named constants, document them, fail closed on a single oversized ID rather
   than dropping it and advancing the cursor. Keep user/source filters on EVERY
   batch; aggregate results before deciding what is missing.
3. Bound inserts by a small named row-count limit (e.g. 50). Recheck current user
   between asynchronous batches and before mutations. No parallel write fan-out.
4. Preserve 23505 individual retry and exact-user duplicate verification within
   the affected batch only. Never overwrite an existing exercise. Count actual
   successful inserts across all batches without resetting the cumulative count.
5. Any failed lookup/write or identity change must prevent exercise cursor
   advancement and must not claim completed=true. Preserve successful earlier
   rows and safe retry behavior; no fake all-or-nothing transaction claim.
6. Do not redesign Steps permissions, step correction, public scoring, time zones
   or account/logout lifecycle. Those are separate known tasks.

## Tests and delivery

Use mocked synthetic records. Cover multiple lookup/insert batches; repeated IDs
across native pages; missing IDs; completed-after-unfinished duplicate; encoded
length limits and oversized ID; later lookup failure; later insert failure;
23505 in a later batch; user switch between batches; cumulative synced counts;
and unchanged cursor on partial failure. Reuse the existing test harness.

If dependencies are absent, one `npm ci --ignore-scripts --no-audit --no-fund`
from the committed lock is permitted, registry packages only. No package changes
or scripts from downloaded packages. Run targeted Jest tests --runInBand and
typecheck. Full-suite failures caused by intentionally omitted transport files
must be distinguished from regressions; do not fabricate passing checks.

Stop after one implementation + tests. Commit ONLY leased paths on this snapshot
branch. Report actual changed paths, test results, commit, limits and open risks.
Do not push, open a PR, merge or start another task. Leave a standard binary-free
unified diff against the initial snapshot commit available for Codex retrieval.
If constrained by permissions or missing context, report the specific blocker.
