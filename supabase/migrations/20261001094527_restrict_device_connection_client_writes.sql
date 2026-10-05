-- Preserve owner reads/deletes and native-health upserts, but keep OAuth
-- credentials and provider identities writable only by the backend.
-- Created by CLI migration new; renamed to the exact MCP-applied history version.
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '15s';

REVOKE ALL PRIVILEGES ON TABLE public.device_connections
  FROM PUBLIC, anon, authenticated;

-- Remove any independent column grants too; table revocation alone is not enough.
DO $acl$
DECLARE col text;
BEGIN
  FOR col IN SELECT attname FROM pg_attribute
    WHERE attrelid = 'public.device_connections'::regclass
      AND attnum > 0 AND NOT attisdropped
  LOOP
    EXECUTE format(
      'REVOKE ALL PRIVILEGES (%I) ON public.device_connections FROM PUBLIC, anon, authenticated', col);
  END LOOP;
END
$acl$;

-- SELECT remains table-wide for existing-client compatibility. RLS still scopes
-- reads and deletes to the owner; ciphertext visibility is a separate follow-up.
GRANT SELECT, DELETE ON public.device_connections TO authenticated;
GRANT INSERT (user_id, provider, is_active) ON public.device_connections TO authenticated;
GRANT UPDATE (user_id, provider, is_active, last_synced_at)
  ON public.device_connections TO authenticated;

-- PostgREST upsert updates every supplied field, including its conflict keys.
-- Permit same-value assignments but never move a credential-bearing row to a
-- different provider/owner. Use the actual SQL role, not client-editable claims.
CREATE FUNCTION public.guard_device_connection_identity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $guard$
BEGIN
  IF current_user IN ('anon', 'authenticated')
     AND (NEW.user_id IS DISTINCT FROM OLD.user_id
          OR NEW.provider IS DISTINCT FROM OLD.provider) THEN
    RAISE EXCEPTION 'Connection owner and provider cannot be changed by clients'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END
$guard$;
REVOKE ALL ON FUNCTION public.guard_device_connection_identity() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER guard_device_connection_identity
BEFORE UPDATE ON public.device_connections
FOR EACH ROW EXECUTE FUNCTION public.guard_device_connection_identity();

-- Exercise the guard on a disposable synthetic table, never real account rows.
CREATE TEMP TABLE connection_identity_probe (
  user_id uuid NOT NULL, provider text NOT NULL, is_active boolean,
  UNIQUE (user_id, provider)
) ON COMMIT DROP;
GRANT ALL ON pg_temp.connection_identity_probe TO authenticated;
CREATE TRIGGER guard_probe BEFORE UPDATE ON pg_temp.connection_identity_probe
FOR EACH ROW EXECUTE FUNCTION public.guard_device_connection_identity();
SET LOCAL ROLE authenticated;
INSERT INTO pg_temp.connection_identity_probe VALUES
  ('00000000-0000-4000-8000-000000000001', 'health_connect', false);
INSERT INTO pg_temp.connection_identity_probe VALUES
  ('00000000-0000-4000-8000-000000000001', 'health_connect', true)
ON CONFLICT (user_id, provider) DO UPDATE
SET user_id = excluded.user_id, provider = excluded.provider, is_active = excluded.is_active;
DO $probe$
BEGIN
  IF NOT (SELECT is_active FROM pg_temp.connection_identity_probe) THEN
    RAISE EXCEPTION 'Same-identity reconnect failed';
  END IF;
  BEGIN
    UPDATE pg_temp.connection_identity_probe SET provider = 'strava';
    RAISE EXCEPTION 'Provider reassignment was not blocked';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    UPDATE pg_temp.connection_identity_probe
      SET user_id = '00000000-0000-4000-8000-000000000002';
    RAISE EXCEPTION 'Owner reassignment was not blocked';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END
$probe$;
RESET ROLE;

DO $verify$
DECLARE col text;
BEGIN
  FOR col IN SELECT attname FROM pg_attribute
    WHERE attrelid = 'public.device_connections'::regclass
      AND attnum > 0 AND NOT attisdropped
  LOOP
    IF has_column_privilege('anon', 'public.device_connections', col, 'SELECT')
       OR has_column_privilege('anon', 'public.device_connections', col, 'INSERT')
       OR has_column_privilege('anon', 'public.device_connections', col, 'UPDATE') THEN
      RAISE EXCEPTION 'Anonymous column privilege remains: %', col;
    END IF;
    IF has_column_privilege('authenticated', 'public.device_connections', col, 'INSERT')
         IS DISTINCT FROM (col = ANY(ARRAY['user_id','provider','is_active']))
       OR has_column_privilege('authenticated', 'public.device_connections', col, 'UPDATE')
         IS DISTINCT FROM (col = ANY(ARRAY['user_id','provider','is_active','last_synced_at'])) THEN
      RAISE EXCEPTION 'Unexpected client write privilege: %', col;
    END IF;
    IF NOT has_column_privilege('service_role', 'public.device_connections', col, 'INSERT')
       OR NOT has_column_privilege('service_role', 'public.device_connections', col, 'UPDATE') THEN
      RAISE EXCEPTION 'Backend write privilege missing: %', col;
    END IF;
  END LOOP;
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.device_connections'::regclass) THEN
    RAISE EXCEPTION 'Connection ownership RLS must remain enabled';
  END IF;
END
$verify$;
COMMIT;
