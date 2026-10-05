-- TEST ONLY. Append after private-health-schema.sql inside baseline BEGIN/ROLLBACK.
DO $guard$ BEGIN
 IF EXISTS(SELECT 1 FROM auth.users) OR NOT EXISTS(
  SELECT 1 FROM streakwar_test_control.environment
   WHERE project_ref='vqizpuqmsykmhlyihyry' AND baseline='catalog-2026-10-05-v1') THEN
  RAISE EXCEPTION 'Refusing non-empty or unmarked test';
 END IF;
END $guard$;
INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES
 ('10000000-0000-4000-8000-000000000001','private-a@example.invalid','{"username":"private_test_a"}'),
 ('10000000-0000-4000-8000-000000000002','private-b@example.invalid','{"username":"private_test_b"}');
INSERT INTO fitness_challenges(id,name,created_by,start_date,end_date,status,is_public,scoring_modes)
 VALUES
 ('20000000-0000-4000-8000-000000000001','Private test challenge 1','10000000-0000-4000-8000-000000000001',current_date,current_date+7,'active',true,ARRAY['steps']),
 ('20000000-0000-4000-8000-000000000002','Private test challenge 2','10000000-0000-4000-8000-000000000001',current_date,current_date+7,'active',true,ARRAY['steps']),
 ('20000000-0000-4000-8000-000000000003','Private test challenge 3','10000000-0000-4000-8000-000000000001',current_date,current_date+7,'active',true,ARRAY['steps']);
INSERT INTO challenge_participants(challenge_id,user_id)
 SELECT c.id,u.id FROM fitness_challenges c CROSS JOIN auth.users u;
INSERT INTO friendships(follower_id,following_id) VALUES
 ('10000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001');
INSERT INTO device_connections(user_id,provider,is_active)
 SELECT id,'health_connect',true FROM auth.users;

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='10000000-0000-4000-8000-000000000001';
SET LOCAL request.jwt.claims='{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}';
INSERT INTO private_health_activities(user_id,source,external_activity_id,activity_type,workout_date,duration_minutes)
 VALUES(auth.uid(),'health_connect','exercise-1','run',current_date,30);
INSERT INTO private_health_activities(user_id,source,external_activity_id,activity_type,workout_date,steps)
 VALUES(auth.uid(),'health_connect','steps-today','walk',current_date,5000);
DO $check$ DECLARE n integer; BEGIN
 BEGIN
  INSERT INTO workout_posts(user_id,source,external_activity_id,activity_type)
   VALUES(auth.uid(),'health_connect','legacy-import','run');
  RAISE EXCEPTION 'Legacy importer can expose health data';
 EXCEPTION WHEN check_violation THEN NULL; END;
 BEGIN
  INSERT INTO workout_posts(user_id,source,external_activity_id,activity_type,challenge_id)
   VALUES(auth.uid(),'health_connect','legacy-import','run','20000000-0000-4000-8000-000000000001');
  RAISE EXCEPTION 'Legacy importer can publish to challenge';
 EXCEPTION WHEN check_violation THEN NULL; END;
 IF (SELECT personal_points FROM get_my_private_activity_summary())<>8 THEN RAISE EXCEPTION 'Initial private score wrong'; END IF;
 BEGIN
  INSERT INTO private_health_activities(user_id,source,external_activity_id,activity_type,workout_date,steps)
   VALUES(auth.uid(),'health_connect','steps-today','walk',current_date,5000);
  RAISE EXCEPTION 'Duplicate import accepted';
 EXCEPTION WHEN unique_violation THEN NULL; END;
 UPDATE private_health_activities SET steps=6000 WHERE user_id=auth.uid() AND source='health_connect' AND external_activity_id='steps-today';
 GET DIAGNOSTICS n=ROW_COUNT;
 IF n<>1 THEN RAISE EXCEPTION 'Update affected % records, expected 1',n; END IF;
 UPDATE private_health_activities SET steps=6000 WHERE user_id=auth.uid() AND source='health_connect' AND external_activity_id='steps-today';
 IF (SELECT personal_points FROM get_my_private_activity_summary())<>9
  OR (SELECT activity_count FROM get_my_private_activity_summary())<>2 THEN
  RAISE EXCEPTION 'Repeat or challenge membership multiplied private score';
 END IF;
 BEGIN
  UPDATE private_health_activities SET user_id='10000000-0000-4000-8000-000000000002';
  RAISE EXCEPTION 'Owner reassignment allowed';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
  UPDATE private_health_activities SET source='manual';
  RAISE EXCEPTION 'Source laundering allowed';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
  UPDATE private_health_activities SET external_activity_id='changed';
  RAISE EXCEPTION 'Identity rewrite allowed';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
  UPDATE private_health_activities SET steps=120001;
  RAISE EXCEPTION 'Invalid steps accepted';
 EXCEPTION WHEN check_violation THEN NULL; END;
END $check$;

SET LOCAL request.jwt.claim.sub='10000000-0000-4000-8000-000000000002';
SET LOCAL request.jwt.claims='{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}';
DO $check$ DECLARE n integer; BEGIN
 IF EXISTS(SELECT 1 FROM private_health_activities)
  OR (SELECT personal_points FROM get_my_private_activity_summary())<>0 THEN
  RAISE EXCEPTION 'Follower/challenge peer can read A private data or score';
 END IF;
 UPDATE private_health_activities SET steps=9999 WHERE user_id='10000000-0000-4000-8000-000000000001';
 GET DIAGNOSTICS n=ROW_COUNT;
 IF n<>0 THEN RAISE EXCEPTION 'B can update A'; END IF;
 DELETE FROM private_health_activities WHERE user_id='10000000-0000-4000-8000-000000000001';
 GET DIAGNOSTICS n=ROW_COUNT;
 IF n<>0 THEN RAISE EXCEPTION 'B can delete A'; END IF;
 BEGIN
  INSERT INTO private_health_activities(user_id,source,external_activity_id,activity_type,workout_date,steps)
   VALUES('10000000-0000-4000-8000-000000000001','health_connect','forbidden','walk',current_date,5000);
  RAISE EXCEPTION 'B can insert for A';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $check$;
INSERT INTO private_health_activities(user_id,source,external_activity_id,activity_type,workout_date,duration_minutes)
 VALUES(auth.uid(),'health_connect','exercise-1','run',current_date,30);
DO $check$ BEGIN
 IF (SELECT activity_count FROM get_my_private_activity_summary())<>1
  OR (SELECT personal_points FROM get_my_private_activity_summary())<>2 THEN
  RAISE EXCEPTION 'Independent user identity or summary failed';
 END IF;
END $check$;

SET LOCAL request.jwt.claim.sub='10000000-0000-4000-8000-000000000001';
SET LOCAL request.jwt.claims='{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}';
UPDATE private_health_activities SET steps=4000 WHERE user_id=auth.uid() AND external_activity_id='steps-today';
DO $check$ BEGIN
 IF (SELECT personal_points FROM get_my_private_activity_summary())<>7 THEN RAISE EXCEPTION 'Correction score wrong'; END IF;
END $check$;
UPDATE device_connections SET is_active=false WHERE user_id=auth.uid() AND provider='health_connect';
DO $check$ DECLARE n integer; BEGIN
 UPDATE private_health_activities SET steps=8000 WHERE user_id=auth.uid() AND external_activity_id='steps-today';
 GET DIAGNOSTICS n=ROW_COUNT;
 IF n<>0 THEN RAISE EXCEPTION 'Inactive connection allowed Steps write'; END IF;
 BEGIN
  INSERT INTO private_health_activities(user_id,source,external_activity_id,activity_type,workout_date,steps)
   VALUES(auth.uid(),'health_connect','after-disconnect','walk',current_date,1000);
  RAISE EXCEPTION 'Inactive connection allowed import';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 IF (SELECT personal_points FROM get_my_private_activity_summary())<>7 THEN
  RAISE EXCEPTION 'Disconnect changed own historical summary';
 END IF;
END $check$;
DELETE FROM private_health_activities WHERE user_id=auth.uid() AND external_activity_id='steps-today';
DO $check$ BEGIN
 IF (SELECT personal_points FROM get_my_private_activity_summary())<>2 THEN RAISE EXCEPTION 'Delete score wrong'; END IF;
 IF EXISTS(SELECT 1 FROM get_weekly_leaderboard(current_date-7)) THEN RAISE EXCEPTION 'Private activities leaked into weekly leaderboard'; END IF;
END $check$;
RESET ROLE;
DO $check$ BEGIN
 IF EXISTS(SELECT 1 FROM workout_posts) OR EXISTS(SELECT 1 FROM profiles WHERE total_points<>0)
  OR EXISTS(SELECT 1 FROM challenge_participants WHERE score<>0)
  OR EXISTS(SELECT 1 FROM user_achievements) OR EXISTS(SELECT 1 FROM streak_milestones)
  OR EXISTS(SELECT 1 FROM user_streaks WHERE current_streak<>0) THEN
  RAISE EXCEPTION 'Private activity changed public/social data';
 END IF;
 IF EXISTS(SELECT 1 FROM pg_publication_tables WHERE schemaname='public' AND tablename='private_health_activities') THEN
  RAISE EXCEPTION 'Private activities added to publication';
 END IF;
 IF has_table_privilege('anon','public.private_health_activities','SELECT')
  OR has_function_privilege('anon','public.get_my_private_activity_summary()','EXECUTE') THEN
  RAISE EXCEPTION 'Anonymous private access granted';
 END IF;
END $check$;
SELECT 'PRIVATE_INTAKE_OWNERSHIP_DEDUP_POINTS_AND_NO_PUBLIC_EFFECTS_PASS' AS result;
