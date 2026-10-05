# Claude SEC01 — verbatim response

Target: ae7fcb4483fce636b75736edd85de0558b7dd815. Read-only Sonnet/Medium.
One request, 3 requested tool-use rounds, reported numTurns=5, duration=40694ms, subtype=success. Different counters are not a token cap.
Local Pro subscription; NOT cloud-session credits. No automatic retry.
User explicitly approved sending the four files after initial policy rejection.

# SEC01 report: no defect substantiated in the changed code, plus three verification gaps

**Files read:** the two migrations, `supabase/tests/device-connection-write-plans.sql`, and `src/hooks/useHealthSync.ts`. I did not read the live `device_token_rpcs` function bodies, the RLS policies or other client code.

## Verified from the files (static reading only)

- **Native upsert compatibility:** the hook upserts `{user_id, provider, is_active}` with `onConflict: 'user_id,provider'` (`useHealthSync.ts:188`, `:230`). That matches the INSERT grant and UPDATE grant (migration 2, lines 28–30). The same-value `user_id`/`provider` assignments pass the guard.
- **Other hook writes:** `last_synced_at` (`:154`) and `is_active` (`:285`) are both granted UPDATE columns. The `.select('provider')` RETURNING works because SELECT is table-wide.
- **Trigger role behavior:** `SECURITY INVOKER` keeps `current_user` as the calling role, so the `anon`/`authenticated` check is sound. Postgres checks EXECUTE on a trigger function only at `CREATE TRIGGER`, so revoking it from `authenticated` (line 51) doesn't break firing.
- **Backend-token access:** all four token RPCs are revoked from `PUBLIC`, `anon` and `authenticated`, granted to `service_role`, and asserted in the same transaction. This matches the service facts you supplied.

## Findings (risks, none a confirmed exploit)

1. **The permission-plan test can print PASS after failing.**
   - **Where:** `device-connection-write-plans.sql:30–32`.
   - **Trigger:** run without `psql -v ON_ERROR_STOP=1`. A failing `DO` aborts the transaction, but the script still runs `ROLLBACK` and then `SELECT 'PASS…'`.
   - **Impact:** a regression can be recorded as passing.
   - **Fix:** add `\set ON_ERROR_STOP on` at the top and move the PASS line inside the `DO` block as a `RAISE NOTICE`.
   - **Synthetic test:** temporarily change line 21 to expect the wrong error class. The script should exit non-zero with no PASS line.

2. **The trigger and RLS are never exercised on the real table.**
   - **Where:** migration 2, lines 57–88; test file header.
   - **Trigger:** the probe uses a temp table with `GRANT ALL`. It proves the function logic only, not that `guard_device_connection_identity` is attached to `public.device_connections`, enabled, or fires under the column grants. EXPLAIN runs no triggers and no RLS `WITH CHECK`.
   - **Impact:** a later migration that drops or disables the trigger would go unnoticed. The upsert's dependence on the existing UPDATE/INSERT policies is unverified.
   - **Fix:** add a `pg_trigger` assertion (`tgenabled = 'O'`, `tgtype` is BEFORE UPDATE ROW) to the test.
   - **Synthetic test:** in a rolled-back transaction, insert a synthetic row, then as `authenticated` with `request.jwt.claims` set, run a real upsert and a provider change. The first should succeed and the second should raise `42501`.

3. **The token RPC revocation covers exact signatures only.**
   - **Where:** migration 1, lines 9–16 and 21–25.
   - **Trigger:** an older overload or sibling SECURITY DEFINER helper with the same name, such as a differently typed `upsert_encrypted_device_tokens` or a decrypt helper. Local migrations 019–021 conflict with live, so overloads could exist there.
   - **Impact:** such a function would keep the default `PUBLIC` or `anon` EXECUTE.
   - **Fix:** this is a read-only check. Query `pg_proc` for `proname ~ '(token|decrypt|device_connection)'` in `public` with `prosecdef` and `has_function_privilege('anon'|'authenticated', oid, 'EXECUTE')`, then revoke by exact `oid::regprocedure`.
   - **Synthetic test:** the catalog query should return zero rows for `anon` and `authenticated`.

## Not substantiated

- No bypass of the identity guard was found from `anon` or `authenticated`.
- No new column write path was found.
- The migration's table and column revoke, followed by its post-check, is correct.

This is not a blanket approval. Real PostgREST, OAuth and phone behavior remain unverified, as you stated.

