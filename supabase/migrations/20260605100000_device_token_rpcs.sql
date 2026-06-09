-- supabase/migrations/20260605100000_device_token_rpcs.sql
--
-- SECURITY DEFINER RPCs for encrypted device token access.
-- Adds external_token_ref column for Garmin request token lookup.
-- Re-encrypts all existing rows with AES-256 cipher.
--
-- PREREQUISITE: Migration 019_encrypt_oauth_tokens.sql must have run.
-- Vault key: SELECT vault.create_secret('oauth_enc_key', '<32-char-key>') must exist.

BEGIN;

-- ── 1. Add external_token_ref column (Garmin request token lookup) ────────────

ALTER TABLE device_connections
  ADD COLUMN IF NOT EXISTS external_token_ref TEXT;

CREATE INDEX IF NOT EXISTS idx_device_connections_external_token_ref
  ON device_connections(external_token_ref)
  WHERE external_token_ref IS NOT NULL;

-- ── 2. Re-encrypt existing rows with AES-256 ──────────────────────────────────

DO $$
DECLARE
  v_key TEXT;
BEGIN
  SELECT decrypted_secret INTO v_key
  FROM vault.decrypted_secrets
  WHERE name = 'oauth_enc_key'
  LIMIT 1;

  IF v_key IS NULL THEN
    RAISE EXCEPTION 'oauth_enc_key not found in Vault.';
  END IF;

  UPDATE device_connections
  SET
    access_token  = extensions.pgp_sym_encrypt(
                      extensions.pgp_sym_decrypt(access_token, v_key),
                      v_key,
                      'cipher-algo=aes256'
                    ),
    refresh_token = extensions.pgp_sym_encrypt(
                      extensions.pgp_sym_decrypt(refresh_token, v_key),
                      v_key,
                      'cipher-algo=aes256'
                    )
  WHERE access_token IS NOT NULL;
END;
$$;

-- ── 3. get_device_connection_decrypted ────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_device_connection_decrypted(
  p_provider          TEXT,
  p_external_user_id  TEXT
)
RETURNS TABLE (
  user_id          UUID,
  access_token     TEXT,
  refresh_token    TEXT,
  token_expires_at TIMESTAMPTZ,
  last_synced_at   TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, vault
AS $$
DECLARE
  v_key TEXT;
BEGIN
  SELECT decrypted_secret INTO v_key
  FROM vault.decrypted_secrets
  WHERE name = 'oauth_enc_key'
  LIMIT 1;

  IF v_key IS NULL THEN
    RAISE EXCEPTION 'oauth_enc_key not found in Vault.';
  END IF;

  RETURN QUERY
  SELECT
    dc.user_id,
    extensions.pgp_sym_decrypt(dc.access_token,  v_key)::TEXT  AS access_token,
    extensions.pgp_sym_decrypt(dc.refresh_token, v_key)::TEXT  AS refresh_token,
    dc.token_expires_at,
    dc.last_synced_at
  FROM device_connections dc
  WHERE dc.provider           = p_provider
    AND dc.external_user_id   = p_external_user_id
    AND dc.is_active          = TRUE;
END;
$$;

REVOKE ALL ON FUNCTION get_device_connection_decrypted(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_device_connection_decrypted(TEXT, TEXT) TO service_role;

-- ── 4. update_encrypted_device_tokens ────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_encrypted_device_tokens(
  p_user_id          UUID,
  p_provider         TEXT,
  p_access_token     TEXT,
  p_refresh_token    TEXT        DEFAULT NULL,
  p_token_expires_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, vault
AS $$
DECLARE
  v_key TEXT;
BEGIN
  SELECT decrypted_secret INTO v_key
  FROM vault.decrypted_secrets
  WHERE name = 'oauth_enc_key'
  LIMIT 1;

  IF v_key IS NULL THEN
    RAISE EXCEPTION 'oauth_enc_key not found in Vault.';
  END IF;

  UPDATE device_connections
  SET
    access_token     = extensions.pgp_sym_encrypt(p_access_token,  v_key, 'cipher-algo=aes256'),
    refresh_token    = CASE
                         WHEN p_refresh_token IS NOT NULL
                         THEN extensions.pgp_sym_encrypt(p_refresh_token, v_key, 'cipher-algo=aes256')
                         ELSE refresh_token
                       END,
    token_expires_at = COALESCE(p_token_expires_at, token_expires_at)
  WHERE user_id  = p_user_id
    AND provider = p_provider;
END;
$$;

REVOKE ALL ON FUNCTION update_encrypted_device_tokens(UUID, TEXT, TEXT, TEXT, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION update_encrypted_device_tokens(UUID, TEXT, TEXT, TEXT, TIMESTAMPTZ) TO service_role;

-- ── 5. upsert_encrypted_device_tokens ────────────────────────────────────────

CREATE OR REPLACE FUNCTION upsert_encrypted_device_tokens(
  p_user_id          UUID,
  p_provider         TEXT,
  p_access_token     TEXT,
  p_refresh_token    TEXT        DEFAULT NULL,
  p_external_user_id TEXT        DEFAULT NULL,
  p_token_expires_at TIMESTAMPTZ DEFAULT NULL,
  p_is_active        BOOLEAN     DEFAULT TRUE,
  p_scope            TEXT        DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, vault
AS $$
DECLARE
  v_key TEXT;
BEGIN
  SELECT decrypted_secret INTO v_key
  FROM vault.decrypted_secrets
  WHERE name = 'oauth_enc_key'
  LIMIT 1;

  IF v_key IS NULL THEN
    RAISE EXCEPTION 'oauth_enc_key not found in Vault.';
  END IF;

  INSERT INTO device_connections (
    user_id,
    provider,
    is_active,
    access_token,
    refresh_token,
    token_expires_at,
    external_user_id,
    last_synced_at
  )
  VALUES (
    p_user_id,
    p_provider,
    p_is_active,
    extensions.pgp_sym_encrypt(p_access_token, v_key, 'cipher-algo=aes256'),
    CASE
      WHEN p_refresh_token IS NOT NULL
      THEN extensions.pgp_sym_encrypt(p_refresh_token, v_key, 'cipher-algo=aes256')
      ELSE NULL
    END,
    p_token_expires_at,
    p_external_user_id,
    NULL
  )
  ON CONFLICT (user_id, provider) DO UPDATE SET
    is_active        = EXCLUDED.is_active,
    access_token     = EXCLUDED.access_token,
    refresh_token    = COALESCE(EXCLUDED.refresh_token, device_connections.refresh_token),
    token_expires_at = COALESCE(EXCLUDED.token_expires_at, device_connections.token_expires_at),
    external_user_id = COALESCE(EXCLUDED.external_user_id, device_connections.external_user_id);
END;
$$;

REVOKE ALL ON FUNCTION upsert_encrypted_device_tokens(UUID, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, BOOLEAN, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION upsert_encrypted_device_tokens(UUID, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, BOOLEAN, TEXT) TO service_role;

-- ── 6. find_garmin_pending ────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION find_garmin_pending(
  p_oauth_token TEXT
)
RETURNS TABLE (
  user_id              UUID,
  request_token_secret TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, vault
AS $$
DECLARE
  v_key TEXT;
BEGIN
  SELECT decrypted_secret INTO v_key
  FROM vault.decrypted_secrets
  WHERE name = 'oauth_enc_key'
  LIMIT 1;

  IF v_key IS NULL THEN
    RAISE EXCEPTION 'oauth_enc_key not found in Vault.';
  END IF;

  RETURN QUERY
  SELECT
    dc.user_id,
    extensions.pgp_sym_decrypt(dc.refresh_token, v_key)::TEXT AS request_token_secret
  FROM device_connections dc
  WHERE dc.external_token_ref = p_oauth_token
    AND dc.provider           = 'garmin'
    AND dc.is_active          = FALSE;
END;
$$;

REVOKE ALL ON FUNCTION find_garmin_pending(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION find_garmin_pending(TEXT) TO service_role;

COMMIT;
