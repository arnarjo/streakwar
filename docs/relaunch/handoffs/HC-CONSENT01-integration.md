# HC-CONSENT01 acceptance — 2026-10-05

Claude base 077c15e623790c08bb0321f135e2196f1a88a186; delivered
03fe22f5b119fdd2aeb0e4e7f7c2e1eac62a4135 in a detached temporary cloud worktree.
Retrieved original tool-output payload via personal Chrome. 7560 base64 chars,
21586 decoded bytes; SHA256 verified:
722ec759778ed1aeb466a720346683f18ffc7c51b2d9793ce04cdbb57ef6b817.

Only leased hook, hook tests and archived report imported. Existing local
changes preserved. Source review confirms the fresh consent lookup precedes
polling; scope rechecked after lookup. Inactive/missing is reconciled only for
Health Connect; errors/unknown fail closed without guessing connection state.
Disconnect reconciles its provider before cleanup and does not replace cleanup
failure with refresh failure. Older fetch revisions cannot resurrect that state.

Codex validation:
- Imported Claude tests before the hook fix: 15 failed /51 passed (66 tests).
  The primary stale-cache case incorrectly resolved and polled on the baseline;
  deferred-lookup baseline cases also timed out because no lookup existed.
- Applied hook change. Added three tests using the REAL unchanged consent helper
  with synthetic Supabase query results: inactive, missing row and query error.
  Verified owner/provider filters, no native poll, no status/upsert writes and
  correct local inactive-vs-unknown handling.
- npm test -- --runInBand: 403 tests /17 suites PASS, without console suppression.
- npm run typecheck: PASS. Targeted eslint: 0 errors /1 existing warning.
- npm run export:android: PASS (JS/assets, not an APK). git diff --check: PASS.

Report count clarification: cloud suite rose from 382 to 400 (18 added runtime
cases), not 20. Archived report's wording about 20 test IDs is inconsistent;
the executed counts above are authoritative. Codex adds 3 for a total of 403.

Supabase skill guided fail-closed handling; existing helper/query API unchanged.
Official maybeSingle docs confirm zero-or-one-row behavior:
https://supabase.com/docs/reference/javascript/maybesingle
No actual backend queries, migrations, privileges, dependencies or native changes.
These tests do not verify production RLS. No real health records used.

Limits: preflight cannot atomically cancel an import if consent changes AFTER
the lookup; no cross-hook broadcast, no runtime/phone proof. F2–F8 remain outside
scope. F1 stale-cache path accepted; C02/T02 remain open. Next bounded item is
F3 same-user auth refresh/navigation regression, before the device checkpoint.
