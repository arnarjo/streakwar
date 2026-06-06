-- supabase/migrations/20260606200000_challenge_calendar_2026.sql
-- Seeds themed monthly challenges (Jul–Dec 2026) and holiday challenges.
-- All are is_global=true, is_public=true, renewal_type='none' (no auto-renewal).

SELECT refresh_challenge_statuses();

-- ── Monthly themed challenges ────────────────────────────────────────────────
INSERT INTO fitness_challenges
  (name, description, created_by, start_date, end_date, status,
   scoring_modes, points_per_workout, points_per_1000_steps, points_per_km, points_per_30min,
   is_public, is_global, renewal_type, tie_break_rule)
VALUES
  ('Sumarchallenge 🌞',
   'Stærsti sumarchallenge StreakWar! Kepptu við alla í allan júlí — skref, kílómetrar og æfingar telja.',
   NULL, '2026-07-01', '2026-07-31',
   CASE WHEN current_date BETWEEN '2026-07-01' AND '2026-07-31' THEN 'active'
        WHEN current_date < '2026-07-01' THEN 'upcoming' ELSE 'completed' END,
   ARRAY['workouts','steps','distance_km'], 2, 1, 1, 2, true, true, 'none', 'most_recent_activity'),

  ('Ágústbrennan 💪',
   'Þrýst á í ágúst! Flestar æfingar og flest skref vinnur.',
   NULL, '2026-08-01', '2026-08-31',
   CASE WHEN current_date BETWEEN '2026-08-01' AND '2026-08-31' THEN 'active'
        WHEN current_date < '2026-08-01' THEN 'upcoming' ELSE 'completed' END,
   ARRAY['workouts','steps'], 2, 1, 1, 2, true, true, 'none', 'most_recent_activity'),

  ('Haustræfing 🍂',
   'Haustið er komið — haldðu þér í formi! Workouts og kílómetrar telja í september.',
   NULL, '2026-09-01', '2026-09-30',
   CASE WHEN current_date BETWEEN '2026-09-01' AND '2026-09-30' THEN 'active'
        WHEN current_date < '2026-09-01' THEN 'upcoming' ELSE 'completed' END,
   ARRAY['workouts','distance_km'], 2, 1, 1, 2, true, true, 'none', 'most_recent_activity'),

  ('Vinterundirbúningur 🥶',
   'Búðu þig undir veturinn! Þessi mánaðarchallenge í október mælir days active, workouts og skref.',
   NULL, '2026-10-01', '2026-10-31',
   CASE WHEN current_date BETWEEN '2026-10-01' AND '2026-10-31' THEN 'active'
        WHEN current_date < '2026-10-01' THEN 'upcoming' ELSE 'completed' END,
   ARRAY['workouts','steps','days_active'], 2, 1, 1, 2, true, true, 'none', 'most_recent_activity'),

  ('Novemberkrafturinn 🏃',
   'Myrkur og kuldi stoppar þig ekki! Hreyfðu þig á hverjum degi í nóvember.',
   NULL, '2026-11-01', '2026-11-30',
   CASE WHEN current_date BETWEEN '2026-11-01' AND '2026-11-30' THEN 'active'
        WHEN current_date < '2026-11-01' THEN 'upcoming' ELSE 'completed' END,
   ARRAY['workouts','days_active'], 2, 1, 1, 2, true, true, 'none', 'most_recent_activity'),

  ('Jólachallenge 🎄',
   'Jólachallenge! Lát ekki jólaveislurnar stoppa þig — workouts, skref og active days telja alla desember.',
   NULL, '2026-12-01', '2026-12-31',
   CASE WHEN current_date BETWEEN '2026-12-01' AND '2026-12-31' THEN 'active'
        WHEN current_date < '2026-12-01' THEN 'upcoming' ELSE 'completed' END,
   ARRAY['workouts','steps','days_active'], 2, 1, 1, 2, true, true, 'none', 'most_recent_activity')

ON CONFLICT DO NOTHING;

-- ── Holiday challenges ────────────────────────────────────────────────────────
INSERT INTO fitness_challenges
  (name, description, created_by, start_date, end_date, status,
   scoring_modes, points_per_workout, points_per_1000_steps, points_per_km, points_per_30min,
   is_public, is_global, renewal_type, tie_break_rule)
VALUES
  ('Jónsmessuchallenge 🌕',
   'Hinn heilagi Jónsmessudagur! Náðu 8.000 skrefum í dag.',
   NULL, '2026-06-24', '2026-06-24',
   CASE WHEN current_date = '2026-06-24' THEN 'active'
        WHEN current_date < '2026-06-24' THEN 'upcoming' ELSE 'completed' END,
   ARRAY['steps'], 1, 1, 1, 1, true, true, 'none', 'most_recent_activity'),

  ('Þjóðhátíðarchallenge 🎉',
   'Þjóðhátíð í Vestmannaeyjum! Hreyfðu þig á þessum 5 dögum og safnaðu stigum.',
   NULL, '2026-08-01', '2026-08-05',
   CASE WHEN current_date BETWEEN '2026-08-01' AND '2026-08-05' THEN 'active'
        WHEN current_date < '2026-08-01' THEN 'upcoming' ELSE 'completed' END,
   ARRAY['workouts','days_active'], 2, 1, 1, 2, true, true, 'none', 'most_recent_activity'),

  ('Halloween 🎃',
   'Halloween challenge! Klárðu eina æfingu á skellilegasta degi ársins.',
   NULL, '2026-10-31', '2026-10-31',
   CASE WHEN current_date = '2026-10-31' THEN 'active'
        WHEN current_date < '2026-10-31' THEN 'upcoming' ELSE 'completed' END,
   ARRAY['workouts'], 2, 1, 1, 2, true, true, 'none', 'most_recent_activity'),

  ('Jólahreyfing ⛄',
   'Jólin eru hér! Hreyfðu þig á aðfangadegi og jólunum — fjórir dagar til að safna stigum.',
   NULL, '2026-12-23', '2026-12-26',
   CASE WHEN current_date BETWEEN '2026-12-23' AND '2026-12-26' THEN 'active'
        WHEN current_date < '2026-12-23' THEN 'upcoming' ELSE 'completed' END,
   ARRAY['workouts','days_active'], 2, 1, 1, 2, true, true, 'none', 'most_recent_activity'),

  ('Áramótachallenge 🎆',
   'Lokaspretturinn! Kepptu við alla í síðustu dögum ársins og fyrstu dögum 2027.',
   NULL, '2026-12-30', '2027-01-02',
   CASE WHEN current_date BETWEEN '2026-12-30' AND '2027-01-02' THEN 'active'
        WHEN current_date < '2026-12-30' THEN 'upcoming' ELSE 'completed' END,
   ARRAY['steps','workouts'], 2, 1, 1, 2, true, true, 'none', 'most_recent_activity')

ON CONFLICT DO NOTHING;
