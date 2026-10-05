# HC-PARTIAL01 — partial health-sync outcomes

Prepared 2026-10-05. State: DISPATCH_ACKNOWLEDGED; report not yet retrieved.
Owner confirmed billing settings unchanged (Extra usage remains disabled).
Official Claude CLI returned ok:true for one follow-up to the existing session.
No new source upload, API fallback or billing-setting change.
Mode: bounded READ-ONLY REVIEW + proposed contract, not implementation.
Main checkpoint: 7195762. Continue existing Claude source-only session
session_01JBigCXGLSLxifMZMBGxSgN at cloud HEAD
1a1f3b57651f23bc5cf5646bbf73b2c458b88228.
HC-LIFE01 accepted locally: 290 tests / 15 suites, typecheck and Android JS
export pass; lint 0 errors / 61 warnings. Four additional Codex regression
tests exist only locally; do not claim your snapshot contains them.

This lease supersedes HC-LIFE01. No new source export is necessary.
Read existing snapshot files: src/lib/healthConnect.ts, healthMapping.ts,
healthConnectBatching.ts, backgroundSync.ts, src/hooks/useHealthSync.ts and
their existing tests. Follow imports within the approved snapshot as needed.
Only writable path: HC-PARTIAL01-result.md (at most 1000 words).
All implementation, tests and config are read-only in this task.

## Question and required evidence

Review partial outcomes independently: exercise import may succeed while Steps
permission/read/write fails; exercise cursor advances independently but the
single completed flag stays false. Trace foreground status/lastSynced and
background task return/status updates. Distinguish actual source behavior from
unverified scheduler effects. Cite exact files/lines and affected call sites.

Propose the smallest backwards-compatible per-type outcome contract and an
explicit truth table covering: no permissions; exercise-only permission; Steps
aggregate failure; exercise batch failure after earlier committed rows; empty
successful window; duplicate-only window; Steps update success; identity change;
cursor storage failure. Define meanings of synced count, completed, permissions,
per-type status, last_synced_at and background result without conflating skipped,
failed and successful states. Do not reinterpret missing permission as success.

Identify retry/dedup guarantees already proved and gaps. Provide deterministic
test cases (mock/deferred promises), affected file list, and any owner/product
decision that prevents implementation. Recommend one minimal next implementation
package; do not implement it until Codex approves the contract. Preserve existing
bounded batching, account lifecycle, identity and consent guards. No schema,
scoring, provider consent, native/background permissions or pricing redesign.

## Safety and delivery

Single agent. No hooks/MCP, services, user data, credentials, network, installs,
new dependencies, new source uploads, cloud builds, publishing, paid usage,
resets, Git push or PR. Synthetic examples only. Do not infer device behavior
from unit tests. No claims that already dispatched database writes are cancelled.
Read-only test runs allowed if useful; report actual commands/results separately
from proposals. No requirement to rerun the whole suite for a read-only report.

Return the report directly in the final response with full cloud base HEAD.
No base64 or patch transport is needed for this report. Stop after delivery.
