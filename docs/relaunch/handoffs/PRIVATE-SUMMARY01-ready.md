# PRIVATE-SUMMARY01 READY — single-agent implementation

Dispatched in authorized personal Chrome Claude cloud session
`session_01JBigCXGLSLxifMZMBGxSgN`. Exact base
`a76e6fc748442c8e50d975e6f157bb14fc2368a6`, tree
`612533d69fd247881cf6a5f8495a746877a269fd`.

Lease: new `src/hooks/usePrivateActivitySummary.ts`,
`src/components/PrivateActivitySummaryCard.tsx`,
`tests/privateActivitySummary.test.ts`, optional result report. Codex owns
backend, Health Connect and screen integration. No other edits, agents,
dependencies, live services, credentials, deployments, pushes or PRs.

Read-only RPC `get_my_private_activity_summary()` has no arguments and returns
exactly one row: owner_id, activity_count, personal_points, total_steps. Validate
current owner and nonnegative safe-integer numbers/decimal strings. No malformed
or failed response may appear as zero-valued success. No data/error logging.
Account/logout/ABA/unmount/request-order guards required. userId and optional
refreshToken props; expose refresh/retry. Keep private metrics out of public
profile/feed/leaderboards. Card clearly labels private scope and unsupported
challenge/leaderboard/streak contribution. Real hook/card tests, full Jest,
typecheck, targeted lint, exact lease-only diff with SHA256 and gzip/base64.
