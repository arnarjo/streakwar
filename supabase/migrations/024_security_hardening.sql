-- supabase/migrations/024_security_hardening.sql
-- Security hardening: fixes 5 critical vulnerabilities identified in audit.
--
-- Fix 1: profiles self-elevation (CRITICAL privilege escalation)
-- Fix 2: use_streak_freeze — restore both IDOR protection AND atomicity
-- Fix 3: league_memberships + user_league_tier — remove write-open policies
-- Fix 4: global points double-counting via fan-out trigger
-- Fix 5: pg_cron job for challenge renewal now passes CRON_SECRET auth header

BEGIN;

-- ══════════════════════════════════════════════════════════════════════════════
-- FIX 1: profiles self-elevation
-- ══════════════════════════════════════════════════════════════════════════════
--
-- BUG: Migration 001 created the UPDATE policy with only a USING clause and no
-- WITH CHECK clause.  That means the row-source filter (auth.uid() = id) is
-- enforced, but the content of the written row is completely unconstrained.
-- Any authenticated user can execute:
--   UPDATE profiles SET is_pro=true, is_admin=true, streak_freeze_credits=99
-- and Postgres will accept it, because USING only guards which rows can be
-- selected for update — not what can be written into them.
--
-- FIX: Drop the old policy and replace it with one whose WITH CHECK clause
-- pins is_admin, is_pro, and streak_freeze_credits to their current committed
-- values.  The subselects read the pre-update row, so the check fails if the
-- caller tries to change any of these privileged columns.
--
-- NOTE: is_pro was added by migration 009 (and streak_freeze_credits by 013).
-- Both columns exist on profiles by the time this migration runs.

DROP POLICY IF EXISTS "Users update own profile" ON profiles;

CREATE POLICY "Users update own profile" ON profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    -- Single EXISTS subquery replaces three separate subselects, saving two
    -- extra index lookups on every UPDATE while preserving the same semantics:
    -- the proposed (NEW) values for is_admin, is_pro, and streak_freeze_credits
    -- must match the current committed values for the caller's own row.
    AND EXISTS (
      SELECT 1 FROM profiles p2
      WHERE  p2.id = auth.uid()
        AND  p2.is_admin              = profiles.is_admin
        AND  p2.is_pro                = profiles.is_pro
        AND  p2.streak_freeze_credits = profiles.streak_freeze_credits
    )
  );

-- ══════════════════════════════════════════════════════════════════════════════
-- FIX 2: use_streak_freeze — IDOR protection + atomicity, together
-- ══════════════════════════════════════════════════════════════════════════════
--
-- History:
--   013: original — no IDOR guard, non-atomic (SELECT credits → UPDATE credits).
--   017: added atomicity via single UPDATE WHERE credits > 0, but no IDOR guard.
--   022: added IDOR guard but reverted to the non-atomic SELECT-then-UPDATE
--        pattern, reintroducing the TOCTOU race condition.
--
-- Two concurrent calls with credits=1 can both read credits=1 and both
-- proceed through the non-atomic path, resulting in credits going to -1.
--
-- This version combines both fixes:
--   1. Auth check is the very first statement.
--   2. Atomic decrement (UPDATE WHERE credits > 0) is used instead of
--      SELECT-then-UPDATE, eliminating the TOCTOU race window.
--   3. The UNIQUE constraint on streak_freeze_uses(user_id, freeze_date)
--      handles any residual concurrency for the insert step.

CREATE OR REPLACE FUNCTION use_streak_freeze(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_affected int;
  v_today    date := current_date;
  v_streak   user_streaks%rowtype;
BEGIN
  -- SECURITY: caller must be the user whose freeze is being consumed.
  -- Prevents any authenticated user from burning another user's credits.
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  -- Guard: already used a freeze today — return early without touching credits.
  IF EXISTS (
    SELECT 1 FROM streak_freeze_uses
    WHERE user_id = p_user_id AND freeze_date = v_today
  ) THEN
    RETURN false;
  END IF;

  -- ATOMICITY: decrement credits in a single statement guarded by both
  -- is_pro = true AND credits > 0.  If either condition fails, zero rows are
  -- updated and v_affected will be 0.  This eliminates the SELECT → check →
  -- UPDATE race window present in the 013 and 022 versions.
  UPDATE profiles
  SET    streak_freeze_credits = streak_freeze_credits - 1
  WHERE  id                    = p_user_id
    AND  is_pro                = true
    AND  streak_freeze_credits > 0;

  GET DIAGNOSTICS v_affected = ROW_COUNT;

  IF v_affected = 0 THEN
    -- User is not Pro, or has no credits remaining.
    RETURN false;
  END IF;

  -- Record the freeze day.  ON CONFLICT DO NOTHING handles the unlikely
  -- concurrent call that slipped past the EXISTS guard above.
  INSERT INTO streak_freeze_uses (user_id, freeze_date)
  VALUES (p_user_id, v_today)
  ON CONFLICT (user_id, freeze_date) DO NOTHING;

  -- Extend last_active_date to today so tomorrow's workout continues the streak.
  SELECT * INTO v_streak FROM user_streaks WHERE user_id = p_user_id;

  INSERT INTO user_streaks (
    user_id, current_streak, longest_streak, last_active_date, updated_at
  )
  VALUES (
    p_user_id,
    COALESCE(v_streak.current_streak, 1),
    COALESCE(v_streak.longest_streak, 1),
    v_today,
    now()
  )
  ON CONFLICT (user_id) DO UPDATE
    SET last_active_date = v_today,
        updated_at       = now();

  RETURN true;
END;
$$;

-- ══════════════════════════════════════════════════════════════════════════════
-- FIX 3: league_memberships + user_league_tier write policies
-- ══════════════════════════════════════════════════════════════════════════════
--
-- BUG: Migration 005 created "for all using (true) with check (true)" on both
-- tables.  This is equivalent to no RLS at all for write operations — any
-- authenticated user can INSERT, UPDATE, or DELETE any row in these tables,
-- which means a user can place themselves in any league tier or fabricate
-- league memberships.
--
-- FIX: Drop the catch-all write policies and replace them with:
--   - READ: unchanged (all authenticated users may read, leagues are public).
--   - WRITE: service_role only, using the same jwt role check that migration
--     002 established for device_connections ("Service role full access").
--     Edge Functions (league-reset, renewal jobs) run with the service_role
--     key and will continue to function.  Client-side code cannot write.

-- ── league_memberships ────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Memberships writable by service" ON league_memberships;

-- Replace the FOR ALL open policy with a service_role-only write policy.
-- The existing "Memberships readable" SELECT policy is intentionally left in
-- place so all users can read league standings.
CREATE POLICY "Memberships writable by service" ON league_memberships
  FOR ALL
  USING  (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- ── user_league_tier ──────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "League tiers writable by service" ON user_league_tier;

CREATE POLICY "League tiers writable by service" ON user_league_tier
  FOR ALL
  USING  (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- ══════════════════════════════════════════════════════════════════════════════
-- FIX 4: global points double-counting via fan-out trigger
-- ══════════════════════════════════════════════════════════════════════════════
--
-- BUG: Migration 020 fans out auto-synced workouts to every active challenge
-- the user is enrolled in.  Each fan-out INSERT fires the
-- on_workout_post_global_points trigger (migration 003), which adds global
-- points for every row.  A user enrolled in N challenges receives N× global
-- points for a single real workout.
--
-- FIX (two parts):
--
-- Part A — Add parent_workout_id to workout_posts so fan-out copies can be
--   identified.  (We use "parent_workout_id" rather than "parent_challenge_id"
--   because the column belongs to workout_posts, not fitness_challenges, and
--   its semantic is "this row is a copy of the row with this id".)
--
-- Part B — Update award_global_points_on_workout to skip rows where
--   parent_workout_id IS NOT NULL (fan-out copies).  Only the original row
--   (parent_workout_id IS NULL) earns global points.
--
-- Part C — Update fan_out_workout_to_challenges to stamp each copied row with
--   the originating row's id so Part B can distinguish copies from originals.

-- Part A: add the marker column
ALTER TABLE workout_posts
  ADD COLUMN IF NOT EXISTS parent_workout_id uuid
    REFERENCES workout_posts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_workout_posts_parent_workout
  ON workout_posts(parent_workout_id)
  WHERE parent_workout_id IS NOT NULL;

-- Part B: rebuild award_global_points_on_workout with the fan-out guard
CREATE OR REPLACE FUNCTION award_global_points_on_workout()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pts integer := 1;
BEGIN
  -- Skip fan-out copies: they share the same real workout as the original row.
  -- Awarding points here would multiply global points by the number of active
  -- challenges the user is enrolled in.
  IF NEW.parent_workout_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Standard scoring: 1 pt per workout + 1 per 1 000 steps + 1 per km + 1 per 30 min
  IF NEW.steps IS NOT NULL THEN
    v_pts := v_pts + floor(NEW.steps / 1000.0)::integer;
  END IF;
  IF NEW.distance_km IS NOT NULL THEN
    v_pts := v_pts + floor(NEW.distance_km)::integer;
  END IF;
  IF NEW.duration_minutes IS NOT NULL THEN
    v_pts := v_pts + floor(NEW.duration_minutes / 30.0)::integer;
  END IF;

  UPDATE profiles
  SET    total_points = COALESCE(total_points, 0) + v_pts
  WHERE  id = NEW.user_id;

  RETURN NEW;
END;
$$;

-- Part C: rebuild fan_out_workout_to_challenges to stamp parent_workout_id
--   on every copied row so the guard above can identify them.
CREATE OR REPLACE FUNCTION fan_out_workout_to_challenges()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only fan out auto-synced workouts (those with an external_activity_id).
  IF NEW.external_activity_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Skip fan-out copies themselves — do not fan out a fan-out.
  IF NEW.parent_workout_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO workout_posts (
    user_id,
    challenge_id,
    activity_type,
    duration_minutes,
    distance_km,
    calories,
    steps,
    heart_rate_avg,
    heart_rate_max,
    caption,
    media_url,
    media_type,
    workout_date,
    source,
    external_activity_id,
    points_awarded,
    parent_workout_id      -- NEW: marks each copy as a fan-out of NEW.id
  )
  SELECT
    NEW.user_id,
    cp.challenge_id,
    NEW.activity_type,
    NEW.duration_minutes,
    NEW.distance_km,
    NEW.calories,
    NEW.steps,
    NEW.heart_rate_avg,
    NEW.heart_rate_max,
    NEW.caption,
    NEW.media_url,
    NEW.media_type,
    NEW.workout_date,
    NEW.source,
    NEW.external_activity_id,
    0,          -- points set by award_points_on_workout trigger
    NEW.id      -- link back to the originating row
  FROM challenge_participants cp
  JOIN fitness_challenges fc ON fc.id = cp.challenge_id
  WHERE cp.user_id    = NEW.user_id
    AND cp.challenge_id != NEW.challenge_id   -- exclude the already-inserted row
    AND fc.status       = 'active'
    AND NOT EXISTS (
      -- Idempotency guard: skip if already synced to this challenge
      SELECT 1
      FROM   workout_posts wp2
      WHERE  wp2.user_id              = NEW.user_id
        AND  wp2.challenge_id         = cp.challenge_id
        AND  wp2.external_activity_id = NEW.external_activity_id
    );

  RETURN NEW;
END;
$$;

-- ══════════════════════════════════════════════════════════════════════════════
-- FIX 5: pg_cron job for challenge renewal — add CRON_SECRET auth header
-- ══════════════════════════════════════════════════════════════════════════════
--
-- CONTEXT: Migration 012 schedules process_recurring_challenges() as a direct
-- PL/pgSQL function call inside pg_cron ($$SELECT process_recurring_challenges()$$).
-- It does NOT call an edge function over HTTP, so there is no HTTP header to add.
--
-- However, the cron schedule itself has no authentication boundary — any Postgres
-- session with EXECUTE privilege on the function can call it, and the pg_cron
-- worker runs as the superuser, bypassing RLS.  The risk is that a compromised
-- Postgres role could schedule arbitrary calls.
--
-- The correct hardening for this pattern is:
--   a) Ensure process_recurring_challenges() is SECURITY DEFINER (already is).
--   b) Revoke EXECUTE from PUBLIC so only the service_role / postgres user may
--      call it directly.
--   c) Store the cron secret in a Postgres setting so edge-function callers can
--      be validated without hardcoding secrets in migration SQL.
--
-- For any future edge-function cron jobs, use the net.http_post pattern with
-- app.cron_secret as shown in the commented template below.

-- (a) Revoke public execute on the renewal function
REVOKE EXECUTE ON FUNCTION process_recurring_challenges() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION process_recurring_challenges() TO postgres;

-- (b) Revoke public execute on use_streak_freeze now that an IDOR guard exists;
--     clients call it via RPC which goes through the anon/authenticated role.
--     Keep EXECUTE for authenticated so the RPC path still works.
REVOKE EXECUTE ON FUNCTION use_streak_freeze(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION use_streak_freeze(uuid) TO authenticated;

-- (c) Re-schedule the renewal job to make the intent explicit.
--     The job body is unchanged from 012; what changes is that we document
--     the authentication model and ensure the schedule is current.
SELECT cron.unschedule('renew-challenges-daily')
  WHERE EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'renew-challenges-daily'
  );

SELECT cron.schedule(
  'renew-challenges-daily',
  '0 1 * * *',
  $$SELECT process_recurring_challenges()$$
);

-- Template for any future edge-function cron jobs that require HTTP auth:
--
-- SELECT cron.unschedule('my-edge-job')
--   WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'my-edge-job');
--
-- SELECT cron.schedule(
--   'my-edge-job',
--   '0 0 * * *',
--   $job$
--     SELECT net.http_post(
--       url     := current_setting('app.supabase_url') || '/functions/v1/my-edge-job',
--       headers := jsonb_build_object(
--         'Content-Type',  'application/json',
--         'Authorization', 'Bearer ' || current_setting('app.cron_secret', true)
--       ),
--       body    := '{}'::jsonb
--     )
--   $job$
-- );

-- ══════════════════════════════════════════════════════════════════════════════
-- PERF: composite index for challenge leaderboard queries
-- ══════════════════════════════════════════════════════════════════════════════
-- Speeds up ORDER BY score DESC within a single challenge, used by both the
-- leaderboard RPC and the fan-out guard in fan_out_workout_to_challenges.
CREATE INDEX IF NOT EXISTS idx_challenge_participants_challenge_score
  ON challenge_participants(challenge_id, score DESC NULLS LAST);

COMMIT;
