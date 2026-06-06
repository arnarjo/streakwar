-- supabase/migrations/20260606100000_daily_missions.sql

-- 1. Add 'daily' to renewal_type enum
ALTER TABLE fitness_challenges
  DROP CONSTRAINT IF EXISTS fitness_challenges_renewal_type_check;
ALTER TABLE fitness_challenges
  ADD CONSTRAINT fitness_challenges_renewal_type_check
    CHECK (renewal_type IN ('none', 'weekly', 'monthly', 'daily'));

-- 2. Daily mission template pool
CREATE TABLE IF NOT EXISTS daily_mission_templates (
  id            serial PRIMARY KEY,
  name          text    NOT NULL,
  description   text    NOT NULL,
  scoring_modes text[]  NOT NULL,
  goal_label    text    NOT NULL,
  sort_order    integer NOT NULL,
  is_active     boolean NOT NULL DEFAULT true
);

INSERT INTO daily_mission_templates
  (name, description, scoring_modes, goal_label, sort_order)
VALUES
  ('Skrefadagur 👟',   'Náðu 8.000 skrefum í dag',              ARRAY['steps'],       '8.000 skref', 1),
  ('Hlaupsdagur 🏃',   'Hlauptu eða gakktu 5 km',               ARRAY['distance_km'], '5 km',        2),
  ('Brennudagur 🔥',   'Brenndu kaloríur í einni æfingu í dag',  ARRAY['workouts'],    'Æfing',       3),
  ('Þolþjálfun 💪',   'Kláraðu 30 mínútna æfingu í dag',        ARRAY['workouts'],    '30 mín',      4),
  ('Göngudagur 🚶',   '10.000 skref í dag',                      ARRAY['steps'],       '10.000 skref',5),
  ('Kílómetrarnir 📍', 'Ferðastu 3 km á hvaða hátt sem er',     ARRAY['distance_km'], '3 km',        6),
  ('Kraftdagur ⚡',    '45 mínútur af hreyfingu',                ARRAY['workouts'],    '45 mín',      7)
ON CONFLICT DO NOTHING;

-- 3. Fix RLS: users can no longer create public challenges
DROP POLICY IF EXISTS "Authenticated users create challenges" ON fitness_challenges;
CREATE POLICY "Authenticated users create challenges" ON fitness_challenges
  FOR INSERT WITH CHECK (
    auth.uid() = created_by
    AND is_public = false
    AND is_global = false
  );
