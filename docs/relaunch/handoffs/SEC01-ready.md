# SEC01 — bounded supplemental backend security review

Task: SEC01 (supplemental; NOT full C04 and does not advance its acceptance)
Mode: REVIEW; master mapping: backend security preparation for T07.
Repository: arnarjo/streakwar, branch codex/streakwar-baseline.
Base: 25c289f (OAuth RPC ACL hotfix); target: ae7fcb4 (connection write boundary).
Contract: NOT_REQUIRED for this narrow least-privilege review.
Dependencies: both hotfixes applied to shared/live Supabase with owner permission;
catalog checks, temporary synthetic guard tests and permission-only EXPLAIN passed.
Real OAuth, PostgREST and phone integration are NOT verified.
Writable scope: NONE. Return report; Codex saves it. No tools beyond Read/Glob/Grep.

Read ONLY these files, batching reads within the three tool-use-round budget:
- supabase/migrations/20261001093330_restrict_device_token_rpc_execution.sql
- supabase/migrations/20261001094527_restrict_device_connection_client_writes.sql
- supabase/tests/device-connection-write-plans.sql
- src/hooks/useHealthSync.ts

Review for concrete regression/security defects: native upsert compatibility,
trigger role behavior, backend-token access, insufficient grant revocation and
misleading verification. Two service facts supplied by Codex: deployed webhook
uses service_role client and get_device_connection_decrypted(provider, external
user ID); token RPCs are postgres-owned SECURITY DEFINER. All roles' effective
column privileges were checked after migration. No real user rows were read.

Known limits: owner ciphertext SELECT remains; normal RLS policies unchanged;
provider consent/activation and public scoring are separate unresolved matters.
Local migration history 019–021 conflicts with live; no bulk push/reset is safe.
Do not spend this review rediscovering those already recorded limitations.

Deliver <=500 words, at most four actionable findings with file/line, trigger,
impact, minimal correction and suggested synthetic test. Distinguish verified
facts from risks. If no new defect is substantiated, say so. No blanket approval.
List files actually read. Do not edit files, run commands, access credentials,
call network/backend services, delegate, or start the C-task queue.
