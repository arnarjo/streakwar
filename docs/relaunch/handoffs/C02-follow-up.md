# C02 receipt and first corrective pass — 2026-10-01

Claude returned a read-only report against code 2fd19de / docs HEAD 5adcf34.
Saved verbatim at `../claude/C02-result.md`. This was a partial source review,
not a base diff: unread scope is explicitly listed. No review acceptance or
release readiness is implied. No second request or automatic retry was made.

User confirmed Extra usage disabled; official Claude Pro auth/status and a
one-turn probe passed before review. Used local Sonnet/Medium subscription path,
not cloud-session credits. Requested max-turns 6; CLI returned numTurns 13 while
report stated 5 tool turns. This mismatch is recorded, not silently presented as
a guaranteed six-turn budget; investigate before relying on that limit again.

| Finding | Disposition |
|---|---|
| 1: restart/worker ignores disconnect | Confirmed. Added active health_connect row + session checks before Android restore, registration and worker polling. Tests cover inactive/missing/failed lookup and account change. Already-in-flight imports are not atomically cancelled by disconnect; lifecycle/race work remains. |
| 2: fire-and-forget logout cleanup | Confirmed in source; pending serialized lifecycle correction/tests. Merely awaiting cleanup may not solve concurrent auth-event startup; do not claim full isolation. |
| 3: unbounded lookup IDs | Confirmed single filter; exact server URL threshold unverified. Bounded read/write batching pending. |
| 4: zero-row sync status reports success | Confirmed. Foreground/worker now filter active connection, return provider rows and require exactly one row before success. Regression tests cover empty/null results. |
| 5: partial Steps grant semantics | Known issue. Per-record completion/status redesign remains pending, not solved by treating failed reads as success. Claimed scheduler penalty is unverified. |
| 6: stale manual-only connection warning | Existing wording says no recent successful sync, not guaranteed background delivery. UX refinement deferred; do not infer background failure from timestamp alone. |
| 7: profile-not-ready permission message | Pending; low-priority misleading message, not actual denial proof. |
| 8: library permission-string support | Not a confirmed defect: installed PermissionUtils.kt explicitly maps BackgroundAccessPermission in both directions; compiled APK declares permission. Device flow remains unverified. |

Prepared a loopback-only synthetic DB test runner and SQL ownership/dedup suite.
No database connection or SQL execution performed; runtime prerequisites absent.
Owner's dashboard link matches the existing shared/live project, not a new test
environment. See `../LOCAL-DATABASE-TESTS.md` for provisioning gates.
