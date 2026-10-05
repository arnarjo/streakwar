# SEC01 triage and receipt

Claude reviewed the four explicitly approved files at ae7fcb4, in one read-only
Sonnet/Medium Pro request. Verbatim output: `../claude/SEC01-result.md`.
Supplemental review delivered; NOT full C04 acceptance or release QA.

1. **Corrected:** a trailing PASS SELECT could run after rollback when a runner
   continues after errors. PASS is now a NOTICE inside the successful DO block.
   No psql-only directive added because MCP also runs this SQL. With psql use
   `psql -X -v ON_ERROR_STOP=1 -f ...` and check exit status. ROLLBACK/empty results
   alone are not success evidence.
2. **Partly addressed, integration pending:** test now verifies pg_trigger points
   at the right function/table and is enabled (`O`), BEFORE UPDATE ROW (`19`).
   Prior catalog verification already checked attachment; now it is repeatable.
   Full synthetic real-table/RLS/PostgREST execution belongs in the isolated DB,
   not live customer tables. Still not verified.
3. **Checked:** live public pg_proc names matching token/decrypt/device_connection/
   garmin_pending returned exactly the four intended definer RPCs plus invoker
   guard. All five deny anon/authenticated EXECUTE; service_role retains access.
   This name-based scan is not an audit of every differently named helper.

Revised permission-plan SQL completed without error via MCP. Negative control
changed only expected trigger-type 19 to 0; MCP returned isError=true and
'Expected enabled BEFORE UPDATE ROW identity guard is missing', with no PASS.
No production row writes, new migration or edits to already-applied migrations.

## Claude usage

Initial export attempt was rejected before launch. Owner approved the four files;
one request executed. Fresh auth check: firstParty/claude.ai/Pro. Existing 24-hour
account-bound extra-usage-disabled attestation passed. No billing/API fallback
changed. Requested 3 tool-use rounds, 300-second timeout; success, numTurns=5,
40.694 seconds, no retry. Reported usage: 4 input, 12,281 cache-creation input,
9,249 cache-read input, 5,096 output tokens (includes 3,072 thinking). These are
token categories, not dollar charges or subscription percentages. This local
request does not use cloud-session credits. Bridge guard tests: 5/5 passed.

Counter investigation: [Anthropic's loop docs](https://code.claude.com/docs/en/agent-sdk/agent-loop)
define max_turns as tool-use round trips, potentially with several tool calls.
The [upstream issue](https://github.com/anthropics/claude-code-action/issues/1795)
describes num_turns differing from that cap. Prior 13-vs-6 does not alone prove
cap bypass. Per-round traces were not collected; neither counter is a hard token
limit. Keep tasks narrow and time-bounded. No adapter permissions expanded.
