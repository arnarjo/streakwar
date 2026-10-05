-- Candidate for the EMPTY ISOLATED TEST baseline only, not a production migration.
-- Run inside hosted-baseline-rehearsal.sql before its final ROLLBACK.
-- No secrets, historical rows, grants to anonymous callers or public score writes.
DO $guard$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM streakwar_test_control.environment
   WHERE project_ref='vqizpuqmsykmhlyihyry' AND baseline='catalog-2026-10-05-v1')
   OR EXISTS (SELECT 1 FROM auth.users) THEN
  RAISE EXCEPTION 'Private intake requires the empty isolated test baseline';
 END IF;
END $guard$;

-- Fail closed for older importers too. This is ONLY for the empty phone-test DB;
-- applying it to historical production data requires a separate migration plan.
ALTER TABLE public.workout_posts ADD CONSTRAINT phone_test_manual_posts_only
 CHECK (source IS NOT DISTINCT FROM 'manual' AND external_activity_id IS NULL AND parent_workout_id IS NULL);

CREATE TABLE public.private_health_activities (
 id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 source text NOT NULL CHECK (source='health_connect'),
 external_activity_id text NOT NULL CHECK (length(external_activity_id) BETWEEN 1 AND 1024),
 activity_type text NOT NULL,
 workout_date date NOT NULL,
 duration_minutes numeric CHECK (duration_minutes > 0 AND duration_minutes <= 1440),
 steps integer CHECK (steps >= 0 AND steps <= 120000),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(user_id,source,external_activity_id),
 CHECK (duration_minutes IS NOT NULL OR steps IS NOT NULL)
);
ALTER TABLE public.private_health_activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY private_health_owner_read ON public.private_health_activities
 FOR SELECT TO authenticated USING ((SELECT auth.uid())=user_id);
CREATE POLICY private_health_owner_insert ON public.private_health_activities
 FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid())=user_id AND EXISTS (
  SELECT 1 FROM public.device_connections dc WHERE dc.user_id=(SELECT auth.uid())
   AND dc.provider='health_connect' AND dc.is_active=true));
CREATE POLICY private_health_owner_update ON public.private_health_activities
 FOR UPDATE TO authenticated USING ((SELECT auth.uid())=user_id AND EXISTS (
  SELECT 1 FROM public.device_connections dc WHERE dc.user_id=(SELECT auth.uid())
   AND dc.provider='health_connect' AND dc.is_active=true))
 WITH CHECK ((SELECT auth.uid())=user_id AND EXISTS (
  SELECT 1 FROM public.device_connections dc WHERE dc.user_id=(SELECT auth.uid())
   AND dc.provider='health_connect' AND dc.is_active=true));
CREATE POLICY private_health_owner_delete ON public.private_health_activities
 FOR DELETE TO authenticated USING ((SELECT auth.uid())=user_id);
REVOKE ALL ON public.private_health_activities FROM PUBLIC,anon,authenticated;
GRANT SELECT,DELETE ON public.private_health_activities TO authenticated;
GRANT INSERT(user_id,source,external_activity_id,activity_type,workout_date,duration_minutes,steps)
 ON public.private_health_activities TO authenticated;
GRANT UPDATE(steps) ON public.private_health_activities TO authenticated;
GRANT ALL ON public.private_health_activities TO service_role;

-- Invoker + RLS, no user-id argument and no public profile side effects.
CREATE FUNCTION public.get_my_private_activity_summary()
RETURNS TABLE(owner_id uuid,activity_count bigint,personal_points bigint,total_steps bigint)
LANGUAGE sql STABLE SECURITY INVOKER
SET search_path=pg_catalog,public,pg_temp
AS $function$
 SELECT (SELECT auth.uid()),count(*),coalesce(sum(1 + coalesce(floor(steps/1000.0),0)
   + coalesce(floor(duration_minutes/30.0),0)),0)::bigint,
   coalesce(sum(steps),0)::bigint
 FROM public.private_health_activities WHERE user_id=(SELECT auth.uid());
$function$;
REVOKE ALL ON FUNCTION public.get_my_private_activity_summary() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_private_activity_summary() TO authenticated,service_role;
