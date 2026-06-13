-- Always-on public challenges: English copy + a rotating "fun" extra.
-- Run in Supabase SQL Editor after 020.
--
-- The whole app is English, but migration 011 seeded the global public
-- challenges (the ones shown in Discover to every user, including those with no
-- friends) with Icelandic names and descriptions — e.g. "Viku Challenge 🔥",
-- "Opið fyrir alla!...". Because the recurring renewal copies the parent's name
-- into each new weekly/monthly instance, that Icelandic text propagates forever
-- and surfaces anywhere a challenge name is shown. This migration:
--   1. Rewrites the seeded weekly + monthly global challenges in English, and
--      back-fills any already-renewed Icelandic child instances.
--   2. Adds a recurring weekly "fun extra" global challenge so there is always
--      a lighter, themed option alongside the standard weekly + monthly ones.

-- ════════════════════════════════════════════════════════════════════════════
-- 1. English copy for the weekly + monthly global challenges.
--    Update the seed rows by their fixed ids, and every renewed child instance
--    (parent_challenge_id chain) by matching the old Icelandic names.
-- ════════════════════════════════════════════════════════════════════════════

-- Weekly global (seed id 0001) + its renewed children
update fitness_challenges
   set name        = 'Weekly Challenge 🔥',
       description  = 'Open to everyone! Jump into this week''s showdown — most points over 7 days wins.'
 where id = '00000000-0000-0000-0001-000000000001'
    or name = 'Viku Challenge 🔥';

-- Monthly global (seed id 0002) + its renewed children
update fitness_challenges
   set name        = 'Monthly Challenge 🏆',
       description  = 'The big one! Go head-to-head with every user all month long. Steps, kilometres and workouts all count.'
 where id = '00000000-0000-0000-0002-000000000001'
    or name = 'Mánaðar Challenge 🏆';

-- ════════════════════════════════════════════════════════════════════════════
-- 2. "Fun extra" always-on weekly global challenge.
--    A lighter, single-metric weekend-friendly push that recurs weekly, so the
--    Discover tab always shows a third, more playful option.
-- ════════════════════════════════════════════════════════════════════════════

insert into fitness_challenges (
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
) values (
  '00000000-0000-0000-0003-000000000001',
  'Weekend Warrior 🎉',
  'Just for fun — rack up the most active minutes this week. No pressure, all bragging rights.',
  null,
  date_trunc('week', current_date)::date,
  (date_trunc('week', current_date) + interval '6 days')::date,
  case
    when date_trunc('week', current_date)::date > current_date then 'upcoming'
    when (date_trunc('week', current_date) + interval '6 days')::date < current_date then 'completed'
    else 'active'
  end,
  array['duration_min','days_active'],
  1,
  1,
  1,
  2,
  true,
  true,
  'weekly',
  'most_recent_activity'
) on conflict (id) do update
  set name        = excluded.name,
      description = excluded.description;
