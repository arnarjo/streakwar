# HC-CONSENT01 dispatch — 2026-10-05

Sent to existing personal-Chrome Claude session session_01JBigCXGLSLxifMZMBGxSgN,
Sonnet 5.5 / Medium. UI confirms base/tree verified and detached worktree setup.
Base: 077c15e623790c08bb0321f135e2196f1a88a186; tree:
05c6d5b04fd525276d4c2f6e19737e933956382e. See HC-CONSENT01-ready.md.

Requires a failing-first regression, fail-closed fresh Android consent check,
scope recheck after lookup, and disconnect state reconciliation while preserving
cleanup failures. No atomic cancellation or app-wide isolation claim.
Only hook, hook tests and result leased; no live/backend/native operations.
Delivery and Codex acceptance pending.

Supabase skill consulted: existing maybeSingle helper remains unchanged;
zero/missing data is not active consent, query errors must not permit imports.
Official maybeSingle reference verified (zero-or-one row result). Markdown
changelog fetch was unsupported; HTML changelog fallback was accessible.
This package does not change Supabase APIs, dependencies, schema or policies.
Verification is synthetic hook/query testing, not a live RLS claim.
