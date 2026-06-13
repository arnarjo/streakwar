-- Recurring / global challenge support
--
-- renewal_type: how the challenge auto-renews after end_date
--   'none'    – one-time challenge (default, existing behavior)
--   'weekly'  – new instance every 7 days
--   'monthly' – new instance on the 1st of each month
--
-- parent_challenge_id: links each auto-created instance back to the
--   original so we can show "Week 3" / "March" labels.
--
-- is_global: true for StreakWar-managed challenges (not created by users).
--   These appear at the top of Discover and cannot be deleted by users.

ALTER TABLE fitness_challenges
  ADD COLUMN IF NOT EXISTS renewal_type        TEXT
    CHECK (renewal_type IN ('none', 'weekly', 'monthly'))
    NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS parent_challenge_id UUID
    REFERENCES fitness_challenges(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_global           BOOLEAN NOT NULL DEFAULT false;

-- Allow created_by to be NULL for system-managed global challenges
-- (normal user challenges still set it via the app)
ALTER TABLE fitness_challenges
  ALTER COLUMN created_by DROP NOT NULL;

-- Update RLS: global challenges (created_by IS NULL) are read-only for everyone
DROP POLICY IF EXISTS "Creator updates challenge" ON fitness_challenges;
CREATE POLICY "Creator updates challenge" ON fitness_challenges
  FOR UPDATE USING (auth.uid() = created_by AND is_global = false);

-- Index for the renewal cron query
CREATE INDEX IF NOT EXISTS idx_challenges_renewal
  ON fitness_challenges(renewal_type, end_date, status)
  WHERE renewal_type != 'none';

-- ─────────────────────────────────────────────────────────────
-- Seed the two permanent global challenges.
-- created_by = NULL (system-owned, no auth user needed).
-- ─────────────────────────────────────────────────────────────

-- Weekly global challenge template
INSERT INTO fitness_challenges (
  id,
  name,
  description,
  created_by,
  start_date,
  end_date,
  status,
  scoring_modes,
  points_per_workout,
  points_per_1000_steps,
  points_per_30min,
  is_public,
  is_global,
  renewal_type,
  tie_break_rule
) VALUES (
  '00000000-0000-0000-0001-000000000001',
  'Weekly Challenge 🔥',
  'Open to everyone! Jump into this week''s showdown — most points over 7 days wins.',
  NULL,
  date_trunc('week', current_date)::date,
  (date_trunc('week', current_date) + interval '6 days')::date,
  CASE
    WHEN date_trunc('week', current_date)::date > current_date THEN 'upcoming'
    WHEN (date_trunc('week', current_date) + interval '6 days')::date < current_date THEN 'completed'
    ELSE 'active'
  END,
  ARRAY['workouts','days_active'],
  1,
  1,
  1,
  true,
  true,
  'weekly',
  'most_recent_activity'
) ON CONFLICT (id) DO NOTHING;

-- Monthly global challenge template
INSERT INTO fitness_challenges (
  id,
  name,
  description,
  created_by,
  start_date,
  end_date,
  status,
  scoring_modes,
  points_per_workout,
  points_per_1000_steps,
  points_per_km,
  points_per_30min,
  is_public,
  is_global,
  renewal_type,
  tie_break_rule
) VALUES (
  '00000000-0000-0000-0002-000000000001',
  'Monthly Challenge 🏆',
  'The big one! Go head-to-head with every user all month long. Steps, kilometres and workouts all count.',
  NULL,
  date_trunc('month', current_date)::date,
  (date_trunc('month', current_date) + interval '1 month - 1 day')::date,
  CASE
    WHEN date_trunc('month', current_date)::date > current_date THEN 'upcoming'
    WHEN (date_trunc('month', current_date) + interval '1 month - 1 day')::date < current_date THEN 'completed'
    ELSE 'active'
  END,
  ARRAY['workouts','days_active','steps','distance_km'],
  2,
  1,
  1,
  2,
  true,
  true,
  'monthly',
  'most_recent_activity'
) ON CONFLICT (id) DO NOTHING;

-- Status auto-update function (replaces the commented-out pg_cron approach)
-- Called by the renew-challenges edge function and also usable standalone.
CREATE OR REPLACE FUNCTION refresh_challenge_statuses()
RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE fitness_challenges
  SET status = CASE
    WHEN start_date > current_date THEN 'upcoming'
    WHEN end_date   < current_date THEN 'completed'
    ELSE 'active'
  END
  WHERE status != 'completed'
     OR end_date >= current_date - interval '1 day';
$$;
