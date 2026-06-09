-- supabase/migrations/019_encrypt_oauth_tokens.sql
-- Encrypt OAuth access_token and refresh_token columns using pgcrypto.
--
-- PREREQUISITE: Create the encryption key in Supabase Dashboard → Vault BEFORE running:
--   SELECT vault.create_secret('oauth_enc_key', '<generate-32-char-random-key>');
-- Generate key: openssl rand -base64 32
--
-- Apply with: supabase db push OR supabase migration up

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Step 1: Add encrypted columns
ALTER TABLE device_connections
  ADD COLUMN IF NOT EXISTS access_token_enc  BYTEA,
  ADD COLUMN IF NOT EXISTS refresh_token_enc BYTEA;

-- Step 2: Migrate existing plaintext tokens to encrypted
DO $$
DECLARE
  enc_key TEXT;
BEGIN
  SELECT decrypted_secret INTO enc_key
  FROM vault.decrypted_secrets
  WHERE name = 'oauth_enc_key'
  LIMIT 1;

  IF enc_key IS NULL THEN
    RAISE EXCEPTION
      'oauth_enc_key not found in Vault. '
      'Create it first: SELECT vault.create_secret(''oauth_enc_key'', ''<32-char-key>'');';
  END IF;

  UPDATE device_connections
  SET
    access_token_enc  = extensions.pgp_sym_encrypt(access_token,  enc_key),
    refresh_token_enc = extensions.pgp_sym_encrypt(refresh_token, enc_key)
  WHERE access_token IS NOT NULL OR refresh_token IS NOT NULL;
END;
$$;

-- Step 3: Drop plaintext columns
ALTER TABLE device_connections
  DROP COLUMN IF EXISTS access_token,
  DROP COLUMN IF EXISTS refresh_token;

-- Step 4: Rename encrypted columns to original names
ALTER TABLE device_connections
  RENAME COLUMN access_token_enc  TO access_token;
ALTER TABLE device_connections
  RENAME COLUMN refresh_token_enc TO refresh_token;

-- Update column comments
COMMENT ON COLUMN device_connections.access_token  IS 'pgcrypto-encrypted OAuth access token (pgp_sym_encrypt with Vault key oauth_enc_key)';
COMMENT ON COLUMN device_connections.refresh_token IS 'pgcrypto-encrypted OAuth refresh token (pgp_sym_encrypt with Vault key oauth_enc_key)';
