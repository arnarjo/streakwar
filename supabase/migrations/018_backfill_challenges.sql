-- Backfill recurring challenges and fix the renewal window.
--
-- Problem: process_recurring_challenges() and the renew-challenges edge function
-- had a 2-day window (end_date >= current_date - interval '2 days'), meaning any
-- recurring challenge that ended more than 2 days ago without a child instance
-- would never be renewed. This migration:
--
-- 1. Fixes process_recurring_challenges() to remove the 2-day restriction.
-- 2. Backfills all completed recurring challenges that have no active/upcoming child,
--    creating a chain of instances up to the current period.

-- ─── Step 1: Fix process_recurring_challenges ────────────────────────────────

CREATE OR REPLACE FUNCTION process_recurring_challenges()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  ch         RECORD;
  next_start DATE;
  next_end   DATE;
BEGIN
  -- Bring all statuses up to date first
  PERFORM refresh_challenge_statuses();

  -- Create the next instance for any completed recurring challenge
  -- that has no child. No time-window restriction — the NOT EXISTS
  -- guard prevents duplicate instances.
  FOR ch IN
    SELECT *
    FROM fitness_challenges fc
    WHERE fc.renewal_type != 'none'
      AND fc.status = 'completed'
      AND NOT EXISTS (
        SELECT 1 FROM fitness_challenges child
        WHERE child.parent_challenge_id = fc.id
      )
    ORDER BY fc.end_date ASC
  LOOP
    IF ch.renewal_type = 'weekly' THEN
      next_start := ch.end_date + 1;
      next_end   := ch.end_date + 7;
    ELSE
      next_start := date_trunc('month', ch.end_date + interval '1 month')::date;
      next_end   := (date_trunc('month', ch.end_date + interval '2 months') - interval '1 day')::date;
    END IF;

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
      CASE WHEN next_start <= current_date THEN
        CASE WHEN next_end < current_date THEN 'completed' ELSE 'active' END
      ELSE 'upcoming' END,
      ch.scoring_modes, ch.points_per_workout, ch.points_per_1000_steps,
      ch.points_per_km, ch.points_per_30min, ch.custom_scoring,
      ch.backlog_days_allowed, ch.require_photo_proof, ch.is_teams_mode,
      ch.tie_break_rule, ch.is_public, ch.is_global, ch.renewal_type,
      ch.id, ch.max_participants
    );
  END LOOP;
END;
$$;

-- ─── Step 2: Backfill — run until all recurring chains have an active/upcoming instance ──

DO $$
DECLARE
  pass INTEGER := 0;
  max_passes INTEGER := 100; -- safety cap (weekly × years)
BEGIN
  -- Run process_recurring_challenges repeatedly until no more gaps exist.
  -- Each pass advances every expired chain by one period. With weekly challenges
  -- and gaps of up to ~2 years, this converges in ≤ 104 passes.
  LOOP
    pass := pass + 1;
    EXIT WHEN pass > max_passes;

    PERFORM process_recurring_challenges();

    -- Stop when every recurring chain has an active or upcoming leaf
    EXIT WHEN NOT EXISTS (
      SELECT 1
      FROM fitness_challenges fc
      WHERE fc.renewal_type != 'none'
        AND fc.status = 'completed'
        AND NOT EXISTS (
          SELECT 1 FROM fitness_challenges child
          WHERE child.parent_challenge_id = fc.id
        )
    );
  END LOOP;

  RAISE NOTICE 'Backfill complete in % pass(es)', pass;
END;
$$;
