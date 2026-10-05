-- TEST ONLY vqizpuqmsykmhlyihyry. Insert before the rehearsal's final ROLLBACK.
-- Characterizes current defects; PASS here is NOT multi-challenge acceptance.
DO $guard$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM streakwar_test_control.environment
    WHERE project_ref='vqizpuqmsykmhlyihyry' AND baseline='catalog-2026-10-05-v1')
    OR EXISTS (SELECT 1 FROM auth.users) THEN
    RAISE EXCEPTION 'Wrong or non-empty test baseline';
  END IF;
END $guard$;

INSERT INTO auth.users (id,email,raw_user_meta_data) VALUES
 ('10000000-0000-4000-8000-000000000001','isolated-a@example.invalid','{"username":"isolated_health_a"}'),
 ('10000000-0000-4000-8000-000000000002','isolated-b@example.invalid','{"username":"isolated_health_b"}');
DO $check$ BEGIN
 IF (SELECT count(*) FROM profiles)<>2 OR (SELECT count(*) FROM user_streaks)<>2 THEN
   RAISE EXCEPTION 'Signup triggers failed';
 END IF;
END $check$;

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='10000000-0000-4000-8000-000000000001';
SET LOCAL request.jwt.claims='{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}';
INSERT INTO public.device_connections (user_id,provider,is_active)
 VALUES (auth.uid(),'health_connect',true)
 ON CONFLICT (user_id,provider) DO UPDATE SET is_active=excluded.is_active;
INSERT INTO public.workout_posts (user_id,activity_type,source,external_activity_id,duration_minutes)
 VALUES (auth.uid(),'running','health_connect','synthetic-exercise-1',30);
INSERT INTO public.workout_posts (user_id,activity_type,source,external_activity_id,steps)
 VALUES (auth.uid(),'walk','health_connect','synthetic-steps-solo',5000);
DO $check$ DECLARE n integer; BEGIN
 UPDATE public.workout_posts SET steps=6000 WHERE user_id=auth.uid() AND external_activity_id='synthetic-steps-solo';
 GET DIAGNOSTICS n=ROW_COUNT;
 IF n<>1 THEN RAISE EXCEPTION 'Solo steps update did not affect one row'; END IF;
 UPDATE public.device_connections SET last_synced_at=now() WHERE user_id=auth.uid() AND provider='health_connect';
 GET DIAGNOSTICS n=ROW_COUNT;
 IF n<>1 THEN RAISE EXCEPTION 'Owner connection update failed'; END IF;
 BEGIN
  UPDATE public.device_connections SET access_token=NULL WHERE user_id=auth.uid();
  RAISE EXCEPTION 'Client token update allowed';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
  UPDATE public.device_connections SET user_id='10000000-0000-4000-8000-000000000002' WHERE user_id=auth.uid();
  RAISE EXCEPTION 'Connection owner reassignment allowed';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
  UPDATE public.profiles SET total_points=9999 WHERE id=auth.uid();
  RAISE EXCEPTION 'Client points update allowed';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
  INSERT INTO public.workout_posts(user_id,activity_type,source,external_activity_id)
    VALUES(auth.uid(),'running','health_connect','synthetic-exercise-1');
  RAISE EXCEPTION 'Same-source duplicate allowed';
 EXCEPTION WHEN unique_violation THEN NULL; END;
 BEGIN
  INSERT INTO public.workout_posts(user_id,activity_type,source,external_activity_id,duration_minutes)
    VALUES(auth.uid(),'running','health_connect','synthetic-invalid-duration',1441);
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM NOT LIKE 'Invalid duration:%' THEN RAISE; END IF;
 END;
 IF EXISTS(SELECT 1 FROM public.workout_posts WHERE external_activity_id='synthetic-invalid-duration') THEN
  RAISE EXCEPTION 'Invalid-duration fixture was accepted';
 END IF;
END $check$;

SET LOCAL request.jwt.claim.sub='10000000-0000-4000-8000-000000000002';
SET LOCAL request.jwt.claims='{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}';
DO $check$ DECLARE n integer; BEGIN
 IF EXISTS(SELECT 1 FROM public.device_connections) OR EXISTS(SELECT 1 FROM public.workout_posts) THEN
  RAISE EXCEPTION 'B can see A private health data';
 END IF;
 UPDATE public.workout_posts SET steps=9999 WHERE user_id='10000000-0000-4000-8000-000000000001';
 GET DIAGNOSTICS n=ROW_COUNT;
 IF n<>0 THEN RAISE EXCEPTION 'B can update A workouts'; END IF;
 BEGIN
  INSERT INTO public.workout_posts(user_id,activity_type,source,external_activity_id)
    VALUES('10000000-0000-4000-8000-000000000001','running','health_connect','forbidden');
  RAISE EXCEPTION 'B can insert for A';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $check$;
INSERT INTO public.workout_posts(user_id,activity_type,source,external_activity_id,duration_minutes)
 VALUES(auth.uid(),'running','health_connect','synthetic-exercise-1',30);

RESET ROLE;
DO $check$ BEGIN
 IF (SELECT total_points FROM profiles WHERE id='10000000-0000-4000-8000-000000000001')<>9 THEN
  RAISE EXCEPTION 'A solo point result unexpected';
 END IF;
 IF (SELECT total_points FROM profiles WHERE id='10000000-0000-4000-8000-000000000002')<>2 THEN
  RAISE EXCEPTION 'B independent point result unexpected';
 END IF;
END $check$;

INSERT INTO fitness_challenges(id,name,created_by,start_date,end_date,status,is_public,scoring_modes)
 VALUES
 ('20000000-0000-4000-8000-000000000001','Synthetic private A','10000000-0000-4000-8000-000000000001',current_date,current_date+7,'active',false,ARRAY['steps']),
 ('20000000-0000-4000-8000-000000000002','Synthetic private B','10000000-0000-4000-8000-000000000001',current_date,current_date+7,'active',false,ARRAY['steps']);
INSERT INTO challenge_participants(challenge_id,user_id) VALUES
 ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001'),
 ('20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001');

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='10000000-0000-4000-8000-000000000001';
SET LOCAL request.jwt.claims='{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}';
INSERT INTO workout_posts(user_id,challenge_id,activity_type,source,external_activity_id,steps)
 VALUES(auth.uid(),'20000000-0000-4000-8000-000000000001','walk','health_connect','synthetic-multi-steps',5000);
DO $known_defects$ BEGIN
 IF (SELECT count(*) FROM workout_posts WHERE external_activity_id='synthetic-multi-steps')<>2 THEN
  RAISE EXCEPTION 'Expected two challenge rows to characterize maybeSingle mismatch';
 END IF;
 BEGIN
  UPDATE workout_posts SET steps=6000,challenge_id='20000000-0000-4000-8000-000000000001'
   WHERE user_id=auth.uid() AND source='health_connect' AND external_activity_id='synthetic-multi-steps';
  RAISE EXCEPTION 'Expected existing multi-challenge update collision not observed';
 EXCEPTION WHEN unique_violation THEN NULL; END;
END $known_defects$;
RESET ROLE;
DO $known_defects$ BEGIN
 IF (SELECT total_points FROM profiles WHERE id='10000000-0000-4000-8000-000000000001')<>21 THEN
  RAISE EXCEPTION 'Expected current double global credit (9 + 6 + 6) not observed';
 END IF;
END $known_defects$;
-- Corrected client UPDATE: source-scoped, preserves each existing challenge.
SET LOCAL ROLE authenticated;
INSERT INTO workout_posts(user_id,activity_type,source,external_activity_id,steps)
 VALUES(auth.uid(),'walk','strava','synthetic-multi-steps',1000);
DO $client_fix$ DECLARE n integer; BEGIN
 UPDATE workout_posts SET steps=6000
  WHERE user_id=auth.uid() AND source='health_connect' AND external_activity_id='synthetic-multi-steps';
 GET DIAGNOSTICS n=ROW_COUNT;
 IF n<>2 THEN RAISE EXCEPTION 'Corrected update must affect both HC copies'; END IF;
 IF (SELECT count(DISTINCT challenge_id) FROM workout_posts
     WHERE user_id=auth.uid() AND source='health_connect' AND external_activity_id='synthetic-multi-steps')<>2
    OR EXISTS(SELECT 1 FROM workout_posts WHERE user_id=auth.uid() AND source='health_connect'
      AND external_activity_id='synthetic-multi-steps' AND steps<>6000) THEN
  RAISE EXCEPTION 'Corrected update changed membership or missed steps';
 END IF;
 IF (SELECT steps FROM workout_posts WHERE user_id=auth.uid() AND source='strava'
     AND external_activity_id='synthetic-multi-steps')<>1000 THEN
  RAISE EXCEPTION 'Corrected update modified another source';
 END IF;
END $client_fix$;
RESET ROLE;
SET LOCAL ROLE anon;
DO $check$ BEGIN
 IF has_table_privilege(current_user,'public.workout_posts','SELECT')
  OR has_table_privilege(current_user,'public.device_connections','SELECT') THEN
  RAISE EXCEPTION 'Anonymous health access granted';
 END IF;
END $check$;
RESET ROLE;
SELECT 'OWNERSHIP_SOLO_AND_CLIENT_UPDATE_PASS; OLD_COLLISION_AND_DOUBLE_POINTS_REPRODUCED' AS result;
