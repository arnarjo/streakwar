-- Restore active global challenge instances for the current week and month.
--
-- Migration 011 seeded the templates with dates calculated at migration-run time.
-- If the cron (renew-challenges) never ran, those templates expired without children
-- and the Discover screen shows nothing. This migration:
--   1. Refreshes all statuses.
--   2. Updates each template to the current period if no active instance exists yet.

SELECT refresh_challenge_statuses();

-- Weekly global challenge → current ISO week (Mon–Sun)
UPDATE fitness_challenges
SET
  start_date = date_trunc('week', current_date)::date,
  end_date   = (date_trunc('week', current_date) + interval '6 days')::date,
  status     = 'active'
WHERE id = '00000000-0000-0000-0001-000000000001'
  AND NOT EXISTS (
    SELECT 1 FROM fitness_challenges
    WHERE is_global     = true
      AND renewal_type  = 'weekly'
      AND status        = 'active'
  );

-- Monthly global challenge → 1st to last day of current month
UPDATE fitness_challenges
SET
  start_date = date_trunc('month', current_date)::date,
  end_date   = (date_trunc('month', current_date) + interval '1 month - 1 day')::date,
  status     = 'active'
WHERE id = '00000000-0000-0000-0002-000000000001'
  AND NOT EXISTS (
    SELECT 1 FROM fitness_challenges
    WHERE is_global     = true
      AND renewal_type  = 'monthly'
      AND status        = 'active'
  );
