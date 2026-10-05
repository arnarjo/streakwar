HC-PARTIAL02A READY — implement additive per-type outcomes only.
Codex accepts HC-PARTIAL01 as source review, not runtime evidence. Continue at cloud base 1a1f3b57651f23bc5cf5646bbf73b2c458b88228. Main accepted code is 7195762 plus handoff docs. No new source upload.

This explicit lease supersedes HC-PARTIAL01. Writable paths ONLY:
src/lib/healthConnect.ts
tests/healthConnectPolling.test.ts
HC-PARTIAL02A-result.md (max 600 words).
Read other existing snapshot files as needed; do not modify them. Preserve HC-PARTIAL01-result.md.

Implement the smallest additive HealthPollResult contract:
exercise?: { status: 'ok'|'skipped'|'failed'; written: number; cursorAdvanced: boolean }
steps?: { status: 'ok'|'skipped'|'failed'; written: number; updated: boolean }
Optional fields keep callers/mocks compatible, but every resolved production poll result must populate both. Each invocation returns fresh objects. written counts confirmed newly inserted rows only; Steps conflict update has written=0 and updated=true only after a returned success (disclose that zero affected rows are not verified by existing API). Exercise ok requires all eligible rows resolved AND cursor save succeeded; zero/duplicate-only successful windows are ok/0. Steps zero aggregate is ok/0/false, not skipped. Missing permission is skipped, never ok. Unattempted phases are skipped, attempted failures failed. Preserve earlier committed row counts on later failures.

Do NOT change existing synced, completed, ranWithPermissions, missingPermissions, thrown-error behavior, cursor movement, permissions, ordering or native/database calls. synced remains exercise inserts plus Steps inserts (not updates). Preserve bounded lookups/inserts, deduplication, retry stopping, polling lock, identity checks and consent guards exactly. No extra reads or writes just to populate status. Errors outside current try/catch keep throwing; don't broaden error swallowing. Do not classify identity failure by matching human error strings. No new abortReason required in this package.

Prove: absent Exercise permission; exercise-only grant; Steps aggregate failure after successful exercise; partial exercise batch failure with successful Steps; empty and duplicate-only windows; successful Steps insert; conflict update; update failure; cursor save failure retaining committed counts; identity switch before/during Steps without subsequent cursor advance; simultaneous skipped poll cannot mutate another result. Synthetic fixtures and deferred promises, no timing sleeps. Existing behavior assertions must remain; adding expected outcome fields to strict comparisons is allowed, weakening/removing prior assertions is not.

Decisions: defer all UI/background consumer behavior changes and last_synced_at reinterpretation to next package. Current all-types completed semantics remain intentionally unchanged, so this alone does not fix the user-facing warning. No schema/native/auth/lifecycle/dependency/scoring/pricing changes. Single agent; no MCP/hooks, network/services, secrets, installs, uploads, paid jobs, pushes, PRs, resets or publication.

Run targeted + full Jest --runInBand, standard typecheck, targeted lint. Commit only leased paths. Report actual results, full HEAD and remaining limitations. Provide exact command-generated incremental diff from the stated cloud base restricted to the three leased files. Print gzip/base64 between PAYLOAD_BEGIN/PAYLOAD_END in ORIGINAL TOOL OUTPUT plus uncompressed SHA256 and bytes; do not retype payload in final response. Keep diff narrow. Stop after delivery.
