-- Metadata/permission planning only: EXPLAIN without ANALYZE executes no writes.
-- Not an ownership-RLS, PostgREST, OAuth or real-client integration test.
-- For psql: use -X -v ON_ERROR_STOP=1 and check exit status. For MCP: check isError.
BEGIN;
SET LOCAL statement_timeout = '10s';
SET LOCAL ROLE authenticated;
DO $test$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.device_connections'::regclass
      AND tgname = 'guard_device_connection_identity'
      AND tgfoid = 'public.guard_device_connection_identity()'::regprocedure
      AND NOT tgisinternal AND tgenabled = 'O' AND tgtype = 19
  ) THEN
    RAISE EXCEPTION 'Expected enabled BEFORE UPDATE ROW identity guard is missing';
  END IF;
  EXECUTE $sql$EXPLAIN INSERT INTO public.device_connections (user_id, provider, is_active)
    VALUES ('00000000-0000-4000-8000-000000000001','health_connect',true)
    ON CONFLICT (user_id, provider) DO UPDATE SET
      user_id = excluded.user_id, provider = excluded.provider, is_active = excluded.is_active$sql$;
  EXECUTE $sql$EXPLAIN UPDATE public.device_connections SET is_active=false
    WHERE user_id='00000000-0000-4000-8000-000000000001' AND provider='health_connect'$sql$;
  EXECUTE $sql$EXPLAIN UPDATE public.device_connections SET last_synced_at=now()
    WHERE user_id='00000000-0000-4000-8000-000000000001' AND provider='health_connect'
    AND is_active=true RETURNING provider$sql$;
  BEGIN
    EXECUTE $sql$EXPLAIN UPDATE public.device_connections SET external_user_id='synthetic-probe'
      WHERE false$sql$;
    RAISE EXCEPTION 'Client provider identity write unexpectedly permitted';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    EXECUTE $sql$EXPLAIN INSERT INTO public.device_connections (user_id,provider,access_token)
      VALUES ('00000000-0000-4000-8000-000000000001','strava',decode('00','hex'))$sql$;
    RAISE EXCEPTION 'Client credential insert unexpectedly permitted';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  RAISE NOTICE 'PASS: client write permission plans and trigger catalog (no row execution)';
END
$test$;
ROLLBACK;
