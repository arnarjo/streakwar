-- supabase/migrations/020_multi_challenge_workout_fan_out.sql
-- Fan-out auto-synced workouts to ALL active challenges the user is enrolled in.
-- Manual logs (external_activity_id IS NULL) are untouched — user picked their challenge.
-- Idempotent: skips if a post for the same external_activity_id already exists for that challenge.
--
-- NOTE: The existing dedup indexes on workout_posts use (user_id, source, external_activity_id)
-- without challenge_id. Fan-out requires the same external_activity_id to appear once per
-- challenge, so we replace those indexes with challenge_id-scoped ones.

-- ── 1. Replace dedup unique indexes to allow per-challenge rows ────────────────
-- Drop both existing dedup indexes (created in 001 and 002)
DROP INDEX IF EXISTS workout_posts_dedup;
DROP INDEX IF EXISTS idx_workout_posts_external_dedup;

-- New index: one row per (user, challenge, source, external_activity_id)
-- This allows the same workout to be recorded across multiple challenges
-- while still preventing double-imports within a single challenge.
CREATE UNIQUE INDEX IF NOT EXISTS workout_posts_dedup
  ON workout_posts(user_id, challenge_id, source, external_activity_id)
  WHERE external_activity_id IS NOT NULL AND challenge_id IS NOT NULL;

-- Fallback dedup for rows without a challenge (challenge_id IS NULL)
CREATE UNIQUE INDEX IF NOT EXISTS workout_posts_dedup_no_challenge
  ON workout_posts(user_id, source, external_activity_id)
  WHERE external_activity_id IS NOT NULL AND challenge_id IS NULL;

-- ── 2. Fan-out trigger function ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fan_out_workout_to_challenges()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only fan out for auto-synced workouts (those with an external_activity_id)
  IF NEW.external_activity_id IS NULL THEN
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
    points_awarded
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
    0  -- points set by award_points_on_workout trigger
  FROM challenge_participants cp
  JOIN fitness_challenges fc ON fc.id = cp.challenge_id
  WHERE cp.user_id = NEW.user_id
    AND cp.challenge_id != NEW.challenge_id   -- exclude the already-inserted row
    AND fc.status = 'active'
    AND NOT EXISTS (
      -- Idempotency guard: skip if already synced to this challenge
      SELECT 1
      FROM workout_posts wp2
      WHERE wp2.user_id = NEW.user_id
        AND wp2.challenge_id = cp.challenge_id
        AND wp2.external_activity_id = NEW.external_activity_id
    );

  RETURN NEW;
END;
$$;

-- ── 3. Attach trigger ──────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS auto_sync_workout_fan_out ON workout_posts;

CREATE TRIGGER auto_sync_workout_fan_out
AFTER INSERT ON workout_posts
FOR EACH ROW
EXECUTE FUNCTION fan_out_workout_to_challenges();

COMMENT ON TRIGGER auto_sync_workout_fan_out ON workout_posts IS
  'Fans out auto-synced workouts to all active challenges the user is enrolled in. '
  'Manual logs (external_activity_id IS NULL) are not affected.';
