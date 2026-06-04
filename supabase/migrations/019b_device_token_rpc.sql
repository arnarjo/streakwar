-- supabase/migrations/019b_device_token_rpc.sql
-- RPC function for edge functions to decrypt and retrieve OAuth tokens.
-- Use this instead of reading the encrypted BYTEA columns directly.

CREATE OR REPLACE FUNCTION get_device_token(
  p_device_id UUID,
  p_user_id   UUID
)
RETURNS TABLE(
  access_token  TEXT,
  refresh_token TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  enc_key TEXT;
BEGIN
  SELECT decrypted_secret INTO enc_key
  FROM vault.decrypted_secrets
  WHERE name = 'oauth_enc_key'
  LIMIT 1;

  IF enc_key IS NULL THEN
    RAISE EXCEPTION 'oauth_enc_key not found in Vault';
  END IF;

  RETURN QUERY
  SELECT
    pgp_sym_decrypt(dc.access_token,  enc_key)::TEXT AS access_token,
    pgp_sym_decrypt(dc.refresh_token, enc_key)::TEXT AS refresh_token
  FROM device_connections dc
  WHERE dc.id      = p_device_id
    AND dc.user_id = p_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION get_device_token(UUID, UUID) TO service_role;
COMMENT ON FUNCTION get_device_token IS
  'Decrypt and return OAuth tokens for a device connection. Use instead of reading encrypted columns directly.';
