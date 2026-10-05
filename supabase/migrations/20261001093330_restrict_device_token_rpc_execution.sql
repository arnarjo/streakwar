-- Emergency least-privilege fix for backend-only OAuth token RPCs.
-- Created with CLI migration new; filename aligned to the applied MCP history version.
-- No function bodies, table rows, keys, tokens or user data are changed.
-- Requires the live device_token_rpcs definitions; do not replay unrelated local
-- migrations against production to satisfy this prerequisite.
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '15s';
REVOKE EXECUTE ON FUNCTION public.find_garmin_pending(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.find_garmin_pending(text) TO service_role;
REVOKE EXECUTE ON FUNCTION public.get_device_connection_decrypted(text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_device_connection_decrypted(text,text) TO service_role;
REVOKE EXECUTE ON FUNCTION public.update_encrypted_device_tokens(uuid,text,text,text,timestamp with time zone) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_encrypted_device_tokens(uuid,text,text,text,timestamp with time zone) TO service_role;
REVOKE EXECUTE ON FUNCTION public.upsert_encrypted_device_tokens(uuid,text,text,text,text,timestamp with time zone,boolean,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_encrypted_device_tokens(uuid,text,text,text,text,timestamp with time zone,boolean,text) TO service_role;

DO $$
DECLARE signature text;
BEGIN
  FOREACH signature IN ARRAY ARRAY[
    'public.find_garmin_pending(text)',
    'public.get_device_connection_decrypted(text,text)',
    'public.update_encrypted_device_tokens(uuid,text,text,text,timestamp with time zone)',
    'public.upsert_encrypted_device_tokens(uuid,text,text,text,text,timestamp with time zone,boolean,text)'
  ] LOOP
    IF has_function_privilege('anon', signature, 'EXECUTE')
       OR has_function_privilege('authenticated', signature, 'EXECUTE')
       OR NOT has_function_privilege('service_role', signature, 'EXECUTE') THEN
      RAISE EXCEPTION 'Unexpected token RPC privileges: %', signature;
    END IF;
  END LOOP;
END $$;
COMMIT;
