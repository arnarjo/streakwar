-- Daily cron job for challenge renewal and status updates.
--
-- Creates a PL/pgSQL function that:
--   1. Refreshes all challenge statuses (upcoming/active/completed)
--   2. Creates the next instance of any recurring challenge that just ended
--
-- Then schedules it via pg_cron at 01:00 UTC every day.
-- pg_cron is enabled by default on Supabase Pro/Team; free tier users
-- can enable it in Dashboard → Database → Extensions → pg_cron.

-- ─── Renewal function ────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION process_recurring_challenges()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  ch         RECORD;
  next_start DATE;
  next_end   DATE;
BEGIN
  -- Step 1: bring all statuses up to date
  PERFORM refresh_challenge_statuses();

  -- Step 2: create the next instance for each recently-completed recurring
  -- challenge that doesn't already have a child instance
  FOR ch IN
    SELECT *
    FROM fitness_challenges
    WHERE renewal_type != 'none'
      AND status = 'completed'
      AND end_date >= current_date - interval '2 days'
      AND end_date <= current_date
      AND NOT EXISTS (
        SELECT 1 FROM fitness_challenges child
        WHERE child.parent_challenge_id = fitness_challenges.id
      )
  LOOP
    IF ch.renewal_type = 'weekly' THEN
      next_start := ch.end_date + 1;
      next_end   := ch.end_date + 7;
    ELSE
      -- Monthly: 1st to last day of next calendar month
      next_start := date_trunc('month', ch.end_date + interval '1 month')::date;
      next_end   := (date_trunc('month', ch.end_date + interval '2 months') - interval '1 day')::date;
    END IF;

    -- For global challenges ch.created_by is NULL (set by migration 011).
    -- custom_scoring is copied so user-created recurring challenges with
    -- custom point rules produce correct child instances.
    INSERT INTO fitness_challenges (
      name, description, cover_image_url, created_by,
      start_date, end_date, status,
      scoring_modes, points_per_workout, points_per_1000_steps,
      points_per_km, points_per_30min, custom_scoring,
      backlog_days_allowed, require_photo_proof, is_teams_mode,
      tie_break_rule, is_public, is_global, renewal_type,
      parent_challenge_id, max_participants
    ) VALUES (
      ch.name, ch.description, ch.cover_image_url, ch.created_by,
      next_start, next_end,
      CASE WHEN next_start <= current_date THEN 'active' ELSE 'upcoming' END,
      ch.scoring_modes, ch.points_per_workout, ch.points_per_1000_steps,
      ch.points_per_km, ch.points_per_30min, ch.custom_scoring,
      ch.backlog_days_allowed, ch.require_photo_proof, ch.is_teams_mode,
      ch.tie_break_rule, ch.is_public, ch.is_global, ch.renewal_type,
      ch.id, ch.max_participants
    );
  END LOOP;
END;
$$;

-- ─── pg_cron schedule ────────────────────────────────────────────────────────

-- Enable the extension (safe to run even if already enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Remove old schedule if it exists (safe re-run)
SELECT cron.unschedule('renew-challenges-daily')
  WHERE EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'renew-challenges-daily'
  );

-- Schedule: daily at 01:00 UTC
SELECT cron.schedule(
  'renew-challenges-daily',
  '0 1 * * *',
  $$SELECT process_recurring_challenges()$$
);
