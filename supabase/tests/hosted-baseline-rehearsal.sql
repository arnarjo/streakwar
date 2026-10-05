-- TEST ONLY: vqizpuqmsykmhlyihyry. Reviewed catalog reconstruction, not production migration history.

-- Default is a rollback-only rehearsal. A separate reviewed application step is required to commit.

BEGIN;

SET LOCAL statement_timeout = '60s';

SET LOCAL lock_timeout = '3s';

SET LOCAL search_path = pg_catalog, public, extensions;

DO $guard$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p','v','m'))
      OR EXISTS (SELECT 1 FROM auth.users) THEN
      RAISE EXCEPTION 'Refusing non-empty database; never erase data to bypass this guard';
    END IF;
    IF to_regnamespace('streakwar_test_control') IS NOT NULL THEN
      RAISE EXCEPTION 'Test baseline already present';
    END IF;
  END $guard$;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;

CREATE SCHEMA streakwar_test_control;

REVOKE ALL ON SCHEMA streakwar_test_control FROM PUBLIC, anon, authenticated;

CREATE TABLE streakwar_test_control.environment (project_ref text PRIMARY KEY, baseline text NOT NULL);

ALTER TABLE streakwar_test_control.environment ENABLE ROW LEVEL SECURITY;

INSERT INTO streakwar_test_control.environment VALUES ('vqizpuqmsykmhlyihyry','catalog-2026-10-05-v1');

CREATE SEQUENCE public.daily_mission_templates_id_seq AS integer START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 CACHE 1 NO CYCLE;

CREATE TYPE public."league_tier" AS ENUM ('bronze', 'silver', 'gold', 'platinum', 'diamond');

CREATE TABLE public."challenge_messages" (
  "id" uuid DEFAULT uuid_generate_v4() NOT NULL,
  "challenge_id" uuid NOT NULL,
  "sender_id" uuid NOT NULL,
  "message_key" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now()
);

ALTER TABLE public."challenge_messages" ENABLE ROW LEVEL SECURITY;

CREATE TABLE public."challenge_participants" (
  "id" uuid DEFAULT uuid_generate_v4() NOT NULL,
  "challenge_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "team_id" uuid,
  "score" integer DEFAULT 0,
  "rank" integer,
  "joined_at" timestamp with time zone DEFAULT now()
);

ALTER TABLE public."challenge_participants" ENABLE ROW LEVEL SECURITY;

CREATE TABLE public."challenge_teams" (
  "id" uuid DEFAULT uuid_generate_v4() NOT NULL,
  "challenge_id" uuid NOT NULL,
  "name" text NOT NULL,
  "score" integer DEFAULT 0
);

ALTER TABLE public."challenge_teams" ENABLE ROW LEVEL SECURITY;

CREATE TABLE public."daily_mission_templates" (
  "id" integer DEFAULT nextval('daily_mission_templates_id_seq'::regclass) NOT NULL,
  "name" text NOT NULL,
  "description" text NOT NULL,
  "scoring_modes" text[] NOT NULL,
  "goal_label" text NOT NULL,
  "sort_order" integer NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL
);

ALTER TABLE public."daily_mission_templates" ENABLE ROW LEVEL SECURITY;

CREATE TABLE public."device_connections" (
  "id" uuid DEFAULT uuid_generate_v4() NOT NULL,
  "user_id" uuid NOT NULL,
  "provider" text NOT NULL,
  "is_active" boolean DEFAULT true,
  "token_expires_at" timestamp with time zone,
  "external_user_id" text,
  "last_synced_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now(),
  "access_token" bytea,
  "refresh_token" bytea,
  "external_token_ref" text
);

ALTER TABLE public."device_connections" ENABLE ROW LEVEL SECURITY;

CREATE TABLE public."fitness_challenges" (
  "id" uuid DEFAULT uuid_generate_v4() NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "cover_image_url" text,
  "created_by" uuid,
  "start_date" date NOT NULL,
  "end_date" date NOT NULL,
  "status" text DEFAULT 'upcoming'::text,
  "scoring_modes" text[] DEFAULT '{workouts}'::text[] NOT NULL,
  "points_per_workout" integer DEFAULT 1,
  "points_per_1000_steps" integer DEFAULT 1,
  "points_per_km" numeric DEFAULT 1,
  "points_per_30min" integer DEFAULT 1,
  "custom_scoring" jsonb,
  "backlog_days_allowed" integer DEFAULT 7,
  "require_photo_proof" boolean DEFAULT false,
  "is_teams_mode" boolean DEFAULT false,
  "tie_break_rule" text DEFAULT 'most_recent_activity'::text NOT NULL,
  "is_public" boolean DEFAULT false,
  "invite_code" text DEFAULT upper(substr(md5((random())::text), 1, 8)),
  "created_at" timestamp with time zone DEFAULT now(),
  "max_participants" integer,
  "renewal_type" text DEFAULT 'none'::text NOT NULL,
  "parent_challenge_id" uuid,
  "is_global" boolean DEFAULT false NOT NULL
);

ALTER TABLE public."fitness_challenges" ENABLE ROW LEVEL SECURITY;

CREATE TABLE public."friendships" (
  "id" uuid DEFAULT uuid_generate_v4() NOT NULL,
  "follower_id" uuid NOT NULL,
  "following_id" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT now()
);

ALTER TABLE public."friendships" ENABLE ROW LEVEL SECURITY;

CREATE TABLE public."league_groups" (
  "id" uuid DEFAULT uuid_generate_v4() NOT NULL,
  "tier" league_tier NOT NULL,
  "week_start" date NOT NULL,
  "created_at" timestamp with time zone DEFAULT now(),
  "group_index" integer DEFAULT 1 NOT NULL
);

ALTER TABLE public."league_groups" ENABLE ROW LEVEL SECURITY;

CREATE TABLE public."league_memberships" (
  "id" uuid DEFAULT uuid_generate_v4() NOT NULL,
  "user_id" uuid NOT NULL,
  "group_id" uuid NOT NULL,
  "week_start" date NOT NULL,
  "final_rank" integer,
  "promoted" boolean DEFAULT false,
  "relegated" boolean DEFAULT false
);

ALTER TABLE public."league_memberships" ENABLE ROW LEVEL SECURITY;

CREATE TABLE public."milestone_reactions" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "milestone_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "reaction" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now()
);

ALTER TABLE public."milestone_reactions" ENABLE ROW LEVEL SECURITY;

CREATE TABLE public."notifications" (
  "id" uuid DEFAULT uuid_generate_v4() NOT NULL,
  "user_id" uuid NOT NULL,
  "type" text NOT NULL,
  "title" text NOT NULL,
  "body" text NOT NULL,
  "data" jsonb,
  "read" boolean DEFAULT false,
  "created_at" timestamp with time zone DEFAULT now()
);

ALTER TABLE public."notifications" ENABLE ROW LEVEL SECURITY;

CREATE TABLE public."nudges" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "sender_id" uuid NOT NULL,
  "receiver_id" uuid NOT NULL,
  "message" text DEFAULT 'Get moving! 💪'::text NOT NULL,
  "emoji" text,
  "nudge_date" date DEFAULT CURRENT_DATE NOT NULL,
  "created_at" timestamp with time zone DEFAULT now(),
  "seen" boolean DEFAULT false
);

ALTER TABLE public."nudges" ENABLE ROW LEVEL SECURITY;

CREATE TABLE public."profiles" (
  "id" uuid NOT NULL,
  "username" text NOT NULL,
  "full_name" text,
  "avatar_url" text,
  "bio" text,
  "is_admin" boolean DEFAULT false,
  "push_token" text,
  "created_at" timestamp with time zone DEFAULT now(),
  "total_points" integer DEFAULT 0 NOT NULL,
  "is_pro" boolean DEFAULT false NOT NULL,
  "pro_expires_at" timestamp with time zone,
  "streak_freeze_credits" integer DEFAULT 0 NOT NULL
);

ALTER TABLE public."profiles" ENABLE ROW LEVEL SECURITY;

CREATE TABLE public."streak_freeze_uses" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "freeze_date" date NOT NULL,
  "created_at" timestamp with time zone DEFAULT now()
);

ALTER TABLE public."streak_freeze_uses" ENABLE ROW LEVEL SECURITY;

CREATE TABLE public."streak_milestones" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "streak_count" integer NOT NULL,
  "achieved_at" timestamp with time zone DEFAULT now()
);

ALTER TABLE public."streak_milestones" ENABLE ROW LEVEL SECURITY;

CREATE TABLE public."user_achievements" (
  "id" uuid DEFAULT uuid_generate_v4() NOT NULL,
  "user_id" uuid NOT NULL,
  "achievement" text NOT NULL,
  "earned_at" timestamp with time zone DEFAULT now()
);

ALTER TABLE public."user_achievements" ENABLE ROW LEVEL SECURITY;

CREATE TABLE public."user_device_tokens" (
  "user_id" uuid NOT NULL,
  "push_token" text NOT NULL,
  "platform" text,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public."user_device_tokens" ENABLE ROW LEVEL SECURITY;

CREATE TABLE public."user_league_tier" (
  "user_id" uuid NOT NULL,
  "tier" league_tier DEFAULT 'bronze'::league_tier NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now()
);

ALTER TABLE public."user_league_tier" ENABLE ROW LEVEL SECURITY;

CREATE TABLE public."user_streaks" (
  "user_id" uuid NOT NULL,
  "current_streak" integer DEFAULT 0,
  "longest_streak" integer DEFAULT 0,
  "last_active_date" date,
  "updated_at" timestamp with time zone DEFAULT now()
);

ALTER TABLE public."user_streaks" ENABLE ROW LEVEL SECURITY;

CREATE TABLE public."workout_comments" (
  "id" uuid DEFAULT uuid_generate_v4() NOT NULL,
  "post_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "content" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now()
);

ALTER TABLE public."workout_comments" ENABLE ROW LEVEL SECURITY;

CREATE TABLE public."workout_posts" (
  "id" uuid DEFAULT uuid_generate_v4() NOT NULL,
  "user_id" uuid NOT NULL,
  "challenge_id" uuid,
  "activity_type" text NOT NULL,
  "duration_minutes" numeric,
  "distance_km" numeric,
  "calories" integer,
  "steps" integer,
  "source" text DEFAULT 'manual'::text,
  "external_activity_id" text,
  "caption" text,
  "media_url" text,
  "media_type" text,
  "points_awarded" integer DEFAULT 0,
  "workout_date" date DEFAULT CURRENT_DATE NOT NULL,
  "posted_at" timestamp with time zone DEFAULT now(),
  "heart_rate_avg" integer,
  "heart_rate_max" integer,
  "parent_workout_id" uuid
);

ALTER TABLE public."workout_posts" ENABLE ROW LEVEL SECURITY;

CREATE TABLE public."workout_reactions" (
  "id" uuid DEFAULT uuid_generate_v4() NOT NULL,
  "post_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "reaction" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now()
);

ALTER TABLE public."workout_reactions" ENABLE ROW LEVEL SECURITY;

ALTER SEQUENCE public.daily_mission_templates_id_seq OWNED BY public.daily_mission_templates.id;

REVOKE ALL ON SEQUENCE public.daily_mission_templates_id_seq FROM PUBLIC, anon, authenticated;

GRANT ALL ON SEQUENCE public.daily_mission_templates_id_seq TO service_role;

ALTER TABLE public."challenge_teams" ADD CONSTRAINT "challenge_teams_pkey" PRIMARY KEY (id);

ALTER TABLE public."profiles" ADD CONSTRAINT "profiles_pkey" PRIMARY KEY (id);

ALTER TABLE public."fitness_challenges" ADD CONSTRAINT "fitness_challenges_pkey" PRIMARY KEY (id);

ALTER TABLE public."friendships" ADD CONSTRAINT "friendships_pkey" PRIMARY KEY (id);

ALTER TABLE public."notifications" ADD CONSTRAINT "notifications_pkey" PRIMARY KEY (id);

ALTER TABLE public."device_connections" ADD CONSTRAINT "device_connections_pkey" PRIMARY KEY (id);

ALTER TABLE public."user_achievements" ADD CONSTRAINT "user_achievements_pkey" PRIMARY KEY (id);

ALTER TABLE public."league_groups" ADD CONSTRAINT "league_groups_pkey" PRIMARY KEY (id);

ALTER TABLE public."user_league_tier" ADD CONSTRAINT "user_league_tier_pkey" PRIMARY KEY (user_id);

ALTER TABLE public."league_memberships" ADD CONSTRAINT "league_memberships_pkey" PRIMARY KEY (id);

ALTER TABLE public."challenge_messages" ADD CONSTRAINT "challenge_messages_pkey" PRIMARY KEY (id);

ALTER TABLE public."challenge_participants" ADD CONSTRAINT "challenge_participants_pkey" PRIMARY KEY (id);

ALTER TABLE public."workout_reactions" ADD CONSTRAINT "workout_reactions_pkey" PRIMARY KEY (id);

ALTER TABLE public."workout_posts" ADD CONSTRAINT "workout_posts_pkey" PRIMARY KEY (id);

ALTER TABLE public."workout_comments" ADD CONSTRAINT "workout_comments_pkey" PRIMARY KEY (id);

ALTER TABLE public."user_streaks" ADD CONSTRAINT "user_streaks_pkey" PRIMARY KEY (user_id);

ALTER TABLE public."streak_freeze_uses" ADD CONSTRAINT "streak_freeze_uses_pkey" PRIMARY KEY (id);

ALTER TABLE public."nudges" ADD CONSTRAINT "nudges_pkey" PRIMARY KEY (id);

ALTER TABLE public."streak_milestones" ADD CONSTRAINT "streak_milestones_pkey" PRIMARY KEY (id);

ALTER TABLE public."milestone_reactions" ADD CONSTRAINT "milestone_reactions_pkey" PRIMARY KEY (id);

ALTER TABLE public."daily_mission_templates" ADD CONSTRAINT "daily_mission_templates_pkey" PRIMARY KEY (id);

ALTER TABLE public."user_device_tokens" ADD CONSTRAINT "user_device_tokens_pkey" PRIMARY KEY (user_id);

ALTER TABLE public."profiles" ADD CONSTRAINT "profiles_username_key" UNIQUE (username);

ALTER TABLE public."fitness_challenges" ADD CONSTRAINT "fitness_challenges_invite_code_key" UNIQUE (invite_code);

ALTER TABLE public."friendships" ADD CONSTRAINT "friendships_follower_id_following_id_key" UNIQUE (follower_id, following_id);

ALTER TABLE public."device_connections" ADD CONSTRAINT "device_connections_user_id_provider_key" UNIQUE (user_id, provider);

ALTER TABLE public."user_achievements" ADD CONSTRAINT "user_achievements_user_id_achievement_key" UNIQUE (user_id, achievement);

ALTER TABLE public."league_memberships" ADD CONSTRAINT "league_memberships_user_id_week_start_key" UNIQUE (user_id, week_start);

ALTER TABLE public."challenge_participants" ADD CONSTRAINT "challenge_participants_challenge_id_user_id_key" UNIQUE (challenge_id, user_id);

ALTER TABLE public."workout_reactions" ADD CONSTRAINT "workout_reactions_post_id_user_id_reaction_key" UNIQUE (post_id, user_id, reaction);

ALTER TABLE public."streak_freeze_uses" ADD CONSTRAINT "streak_freeze_uses_user_id_freeze_date_key" UNIQUE (user_id, freeze_date);

ALTER TABLE public."nudges" ADD CONSTRAINT "nudges_sender_id_receiver_id_nudge_date_key" UNIQUE (sender_id, receiver_id, nudge_date);

ALTER TABLE public."streak_milestones" ADD CONSTRAINT "streak_milestones_user_id_streak_count_key" UNIQUE (user_id, streak_count);

ALTER TABLE public."milestone_reactions" ADD CONSTRAINT "milestone_reactions_milestone_id_user_id_key" UNIQUE (milestone_id, user_id);

ALTER TABLE public."daily_mission_templates" ADD CONSTRAINT "daily_mission_templates_sort_order_key" UNIQUE (sort_order);

ALTER TABLE public."fitness_challenges" ADD CONSTRAINT "fitness_challenges_renewal_type_check" CHECK ((renewal_type = ANY (ARRAY['none'::text, 'weekly'::text, 'monthly'::text, 'daily'::text])));

ALTER TABLE public."fitness_challenges" ADD CONSTRAINT "fitness_challenges_status_check" CHECK ((status = ANY (ARRAY['upcoming'::text, 'active'::text, 'completed'::text])));

ALTER TABLE public."fitness_challenges" ADD CONSTRAINT "fitness_challenges_tie_break_rule_check" CHECK ((tie_break_rule = ANY (ARRAY['first_to_score'::text, 'most_recent_activity'::text, 'most_workouts'::text])));

ALTER TABLE public."friendships" ADD CONSTRAINT "friendships_check" CHECK ((follower_id <> following_id));

ALTER TABLE public."workout_posts" ADD CONSTRAINT "workout_posts_media_type_check" CHECK ((media_type = ANY (ARRAY['photo'::text, 'video'::text])));

ALTER TABLE public."workout_posts" ADD CONSTRAINT "workout_posts_source_check" CHECK ((source = ANY (ARRAY['manual'::text, 'apple_health'::text, 'health_connect'::text, 'strava'::text, 'garmin'::text, 'fitbit'::text, 'samsung_health'::text])));

ALTER TABLE public."challenge_teams" ADD CONSTRAINT "challenge_teams_challenge_id_fkey" FOREIGN KEY (challenge_id) REFERENCES fitness_challenges(id) ON DELETE CASCADE;

ALTER TABLE public."profiles" ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public."fitness_challenges" ADD CONSTRAINT "fitness_challenges_created_by_fkey" FOREIGN KEY (created_by) REFERENCES profiles(id);

ALTER TABLE public."fitness_challenges" ADD CONSTRAINT "fitness_challenges_parent_challenge_id_fkey" FOREIGN KEY (parent_challenge_id) REFERENCES fitness_challenges(id) ON DELETE SET NULL;

ALTER TABLE public."friendships" ADD CONSTRAINT "friendships_follower_id_fkey" FOREIGN KEY (follower_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE public."friendships" ADD CONSTRAINT "friendships_following_id_fkey" FOREIGN KEY (following_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE public."notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE public."device_connections" ADD CONSTRAINT "device_connections_user_id_fkey" FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE public."user_achievements" ADD CONSTRAINT "user_achievements_user_id_fkey" FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE public."user_league_tier" ADD CONSTRAINT "user_league_tier_user_id_fkey" FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE public."league_memberships" ADD CONSTRAINT "league_memberships_group_id_fkey" FOREIGN KEY (group_id) REFERENCES league_groups(id) ON DELETE CASCADE;

ALTER TABLE public."league_memberships" ADD CONSTRAINT "league_memberships_user_id_fkey" FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE public."challenge_messages" ADD CONSTRAINT "challenge_messages_challenge_id_fkey" FOREIGN KEY (challenge_id) REFERENCES fitness_challenges(id) ON DELETE CASCADE;

ALTER TABLE public."challenge_messages" ADD CONSTRAINT "challenge_messages_sender_id_fkey" FOREIGN KEY (sender_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE public."challenge_participants" ADD CONSTRAINT "challenge_participants_challenge_id_fkey" FOREIGN KEY (challenge_id) REFERENCES fitness_challenges(id) ON DELETE CASCADE;

ALTER TABLE public."challenge_participants" ADD CONSTRAINT "challenge_participants_user_id_fkey" FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE public."workout_reactions" ADD CONSTRAINT "workout_reactions_post_id_fkey" FOREIGN KEY (post_id) REFERENCES workout_posts(id) ON DELETE CASCADE;

ALTER TABLE public."workout_reactions" ADD CONSTRAINT "workout_reactions_user_id_fkey" FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE public."workout_posts" ADD CONSTRAINT "workout_posts_challenge_id_fkey" FOREIGN KEY (challenge_id) REFERENCES fitness_challenges(id) ON DELETE SET NULL;

ALTER TABLE public."workout_posts" ADD CONSTRAINT "workout_posts_parent_workout_id_fkey" FOREIGN KEY (parent_workout_id) REFERENCES workout_posts(id) ON DELETE SET NULL;

ALTER TABLE public."workout_posts" ADD CONSTRAINT "workout_posts_user_id_fkey" FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE public."workout_comments" ADD CONSTRAINT "workout_comments_post_id_fkey" FOREIGN KEY (post_id) REFERENCES workout_posts(id) ON DELETE CASCADE;

ALTER TABLE public."workout_comments" ADD CONSTRAINT "workout_comments_user_id_fkey" FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE public."user_streaks" ADD CONSTRAINT "user_streaks_user_id_fkey" FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE public."streak_freeze_uses" ADD CONSTRAINT "streak_freeze_uses_user_id_fkey" FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE public."nudges" ADD CONSTRAINT "nudges_receiver_id_fkey" FOREIGN KEY (receiver_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE public."nudges" ADD CONSTRAINT "nudges_sender_id_fkey" FOREIGN KEY (sender_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE public."streak_milestones" ADD CONSTRAINT "streak_milestones_user_id_fkey" FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE public."milestone_reactions" ADD CONSTRAINT "milestone_reactions_milestone_id_fkey" FOREIGN KEY (milestone_id) REFERENCES streak_milestones(id) ON DELETE CASCADE;

ALTER TABLE public."milestone_reactions" ADD CONSTRAINT "milestone_reactions_user_id_fkey" FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE public."user_device_tokens" ADD CONSTRAINT "user_device_tokens_user_id_fkey" FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

CREATE INDEX idx_challenge_messages_challenge ON public.challenge_messages USING btree (challenge_id, created_at DESC);

CREATE INDEX idx_challenge_participants_challenge_id ON public.challenge_participants USING btree (challenge_id);

CREATE INDEX idx_challenge_participants_challenge_score ON public.challenge_participants USING btree (challenge_id, score DESC NULLS LAST);

CREATE INDEX idx_challenge_participants_challenge_user ON public.challenge_participants USING btree (challenge_id, user_id);

CREATE INDEX idx_challenge_participants_user_id ON public.challenge_participants USING btree (user_id);

CREATE INDEX idx_device_connections_external_id ON public.device_connections USING btree (provider, external_user_id) WHERE (is_active = true);

CREATE INDEX idx_device_connections_external_token_ref ON public.device_connections USING btree (external_token_ref) WHERE (external_token_ref IS NOT NULL);

CREATE INDEX idx_challenges_renewal ON public.fitness_challenges USING btree (renewal_type, end_date, status) WHERE (renewal_type <> 'none'::text);

CREATE INDEX idx_fitness_challenges_is_public ON public.fitness_challenges USING btree (is_public) WHERE (is_public = true);

CREATE INDEX idx_friendships_follower ON public.friendships USING btree (follower_id);

CREATE INDEX idx_friendships_following ON public.friendships USING btree (following_id);

CREATE UNIQUE INDEX uq_league_groups_tier_week_index ON public.league_groups USING btree (tier, week_start, group_index);

CREATE INDEX idx_memberships_group ON public.league_memberships USING btree (group_id, week_start);

CREATE INDEX idx_memberships_user_week ON public.league_memberships USING btree (user_id, week_start);

CREATE INDEX idx_notifications_user_id ON public.notifications USING btree (user_id);

CREATE INDEX idx_profiles_total_points ON public.profiles USING btree (total_points DESC);

CREATE INDEX idx_user_achievements_user ON public.user_achievements USING btree (user_id);

CREATE INDEX idx_user_device_tokens_user_id ON public.user_device_tokens USING btree (user_id);

CREATE INDEX idx_workout_posts_challenge_id ON public.workout_posts USING btree (challenge_id);

CREATE INDEX idx_workout_posts_parent_workout ON public.workout_posts USING btree (parent_workout_id) WHERE (parent_workout_id IS NOT NULL);

CREATE INDEX idx_workout_posts_posted_at ON public.workout_posts USING btree (posted_at DESC);

CREATE INDEX idx_workout_posts_user_id ON public.workout_posts USING btree (user_id);

CREATE INDEX idx_workout_posts_workout_date ON public.workout_posts USING btree (user_id, workout_date DESC);

CREATE UNIQUE INDEX workout_posts_dedup ON public.workout_posts USING btree (user_id, challenge_id, source, external_activity_id) WHERE ((external_activity_id IS NOT NULL) AND (challenge_id IS NOT NULL));

CREATE UNIQUE INDEX workout_posts_dedup_no_challenge ON public.workout_posts USING btree (user_id, source, external_activity_id) WHERE ((external_activity_id IS NOT NULL) AND (challenge_id IS NULL));

CREATE OR REPLACE FUNCTION public.workout_points(p_steps numeric, p_distance_km numeric, p_duration_min numeric)
 RETURNS integer
 LANGUAGE sql
 IMMUTABLE
AS $function$
 select 1
 + coalesce(floor(p_steps / 1000.0)::integer, 0)
 + coalesce(floor(p_distance_km )::integer, 0)
 + coalesce(floor(p_duration_min / 30.0)::integer, 0);
$function$;

ALTER FUNCTION public."workout_points"(p_steps numeric, p_distance_km numeric, p_duration_min numeric) SET search_path = pg_catalog, public, extensions, pg_temp;

REVOKE ALL ON FUNCTION public."workout_points"(p_steps numeric, p_distance_km numeric, p_duration_min numeric) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public."workout_points"(p_steps numeric, p_distance_km numeric, p_duration_min numeric) TO service_role;

GRANT EXECUTE ON FUNCTION public."workout_points"(p_steps numeric, p_distance_km numeric, p_duration_min numeric) TO authenticated;

CREATE OR REPLACE FUNCTION public.check_challenge_capacity()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
 declare
 v_max integer;
 v_count integer;
 begin
 -- Lock the challenge row for the duration of this transaction so concurrent
 -- inserts for the same challenge are serialized, not interleaved.
 select max_participants into v_max
 from fitness_challenges
 where id = new.challenge_id
 for update;

 -- Unlimited challenges skip the count check entirely.
 if v_max is null then return new; end if;

 select count(*) into v_count
 from challenge_participants
 where challenge_id = new.challenge_id;

 if v_count >= v_max then
 raise exception 'Challenge is full' using errcode = 'P0001';
 end if;

 return new;
 end;
 $function$;

ALTER FUNCTION public."check_challenge_capacity"() SET search_path = pg_catalog, public, extensions, pg_temp;

REVOKE ALL ON FUNCTION public."check_challenge_capacity"() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public."check_challenge_capacity"() TO service_role;

CREATE OR REPLACE FUNCTION public.award_global_points_on_workout()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
declare
 v_pts integer;
begin
 v_pts := workout_points(new.steps, new.distance_km, new.duration_minutes);
 update profiles
 set total_points = coalesce(total_points, 0) + v_pts
 where id = new.user_id;
 return new;
end;
$function$;

ALTER FUNCTION public."award_global_points_on_workout"() SET search_path = pg_catalog, public, extensions, pg_temp;

REVOKE ALL ON FUNCTION public."award_global_points_on_workout"() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public."award_global_points_on_workout"() TO service_role;

CREATE OR REPLACE FUNCTION public.check_achievements_on_workout()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
 v_workout_count integer;
 v_total_points integer;
 v_streak integer;
 v_total_steps bigint;
begin
 -- Fetch current stats
 select count(*) into v_workout_count from workout_posts where user_id = new.user_id;
 select total_points into v_total_points from profiles where id = new.user_id;
 select current_streak into v_streak from user_streaks where user_id = new.user_id;
 select coalesce(sum(steps), 0)
 into v_total_steps from workout_posts where user_id = new.user_id and steps is not null;

 -- First workout ever
 if v_workout_count = 1 then
 insert into user_achievements (user_id, achievement)
 values (new.user_id, 'first_workout') on conflict do nothing;
 end if;

 -- Workout count milestones
 if v_workout_count >= 10 then insert into user_achievements (user_id, achievement) values (new.user_id, 'workouts_10') on conflict do nothing; end if;
 if v_workout_count >= 50 then insert into user_achievements (user_id, achievement) values (new.user_id, 'workouts_50') on conflict do nothing; end if;
 if v_workout_count >= 100 then insert into user_achievements (user_id, achievement) values (new.user_id, 'workouts_100') on conflict do nothing; end if;

 -- Points milestones
 if v_total_points >= 100 then insert into user_achievements (user_id, achievement) values (new.user_id, 'pts_100') on conflict do nothing; end if;
 if v_total_points >= 500 then insert into user_achievements (user_id, achievement) values (new.user_id, 'pts_500') on conflict do nothing; end if;
 if v_total_points >= 1000 then insert into user_achievements (user_id, achievement) values (new.user_id, 'pts_1000') on conflict do nothing; end if;
 if v_total_points >= 5000 then insert into user_achievements (user_id, achievement) values (new.user_id, 'pts_5000') on conflict do nothing; end if;

 -- Streak milestones
 if v_streak >= 3 then insert into user_achievements (user_id, achievement) values (new.user_id, 'streak_3') on conflict do nothing; end if;
 if v_streak >= 7 then insert into user_achievements (user_id, achievement) values (new.user_id, 'streak_7') on conflict do nothing; end if;
 if v_streak >= 14 then insert into user_achievements (user_id, achievement) values (new.user_id, 'streak_14') on conflict do nothing; end if;
 if v_streak >= 30 then insert into user_achievements (user_id, achievement) values (new.user_id, 'streak_30') on conflict do nothing; end if;
 if v_streak >= 100 then insert into user_achievements (user_id, achievement) values (new.user_id, 'streak_100') on conflict do nothing; end if;

 -- Steps milestone
 if v_total_steps >= 100000 then insert into user_achievements (user_id, achievement) values (new.user_id, 'steps_100k') on conflict do nothing; end if;

 return new;
end;
$function$;

ALTER FUNCTION public."check_achievements_on_workout"() SET search_path = pg_catalog, public, extensions, pg_temp;

REVOKE ALL ON FUNCTION public."check_achievements_on_workout"() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public."check_achievements_on_workout"() TO service_role;

CREATE OR REPLACE FUNCTION public.guard_device_connection_identity()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
 IF current_user IN ('anon', 'authenticated')
 AND (NEW.user_id IS DISTINCT FROM OLD.user_id
 OR NEW.provider IS DISTINCT FROM OLD.provider) THEN
 RAISE EXCEPTION 'Connection owner and provider cannot be changed by clients'
 USING ERRCODE = '42501';
 END IF;
 RETURN NEW;
END
$function$;

ALTER FUNCTION public."guard_device_connection_identity"() SET search_path = pg_catalog, public, extensions, pg_temp;

REVOKE ALL ON FUNCTION public."guard_device_connection_identity"() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public."guard_device_connection_identity"() TO service_role;

CREATE OR REPLACE FUNCTION public.get_league_group_leaderboard(p_group_id uuid, p_week_start date)
 RETURNS TABLE(user_id uuid, username text, full_name text, tier text, weekly_points bigint)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
 select
 p.id as user_id,
 p.username,
 p.full_name,
 ult.tier::text,
 coalesce(sum(
 1
 + coalesce(floor(wp.steps / 1000.0)::integer, 0)
 + coalesce(floor(wp.distance_km )::integer, 0)
 + coalesce(floor(wp.duration_minutes / 30.0 )::integer, 0)
 ), 0) as weekly_points
 from league_memberships lm
 join profiles p on p.id = lm.user_id
 left join user_league_tier ult on ult.user_id = p.id
 left join workout_posts wp
 on wp.user_id = p.id
 and wp.workout_date >= p_week_start
 and wp.workout_date <= current_date
 where lm.group_id = p_group_id
 and lm.week_start = p_week_start
 group by p.id, p.username, p.full_name, ult.tier
 order by weekly_points desc;
$function$;

ALTER FUNCTION public."get_league_group_leaderboard"(p_group_id uuid, p_week_start date) SET search_path = pg_catalog, public, extensions, pg_temp;

REVOKE ALL ON FUNCTION public."get_league_group_leaderboard"(p_group_id uuid, p_week_start date) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public."get_league_group_leaderboard"(p_group_id uuid, p_week_start date) TO service_role;

GRANT EXECUTE ON FUNCTION public."get_league_group_leaderboard"(p_group_id uuid, p_week_start date) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_weekly_leaderboard(week_start date)
 RETURNS TABLE(id uuid, username text, full_name text, total_points integer, weekly_points bigint)
 LANGUAGE sql
 SECURITY DEFINER
AS $function$
 select
 p.id,
 p.username,
 p.full_name,
 p.total_points,
 coalesce(sum(workout_points(wp.steps, wp.distance_km, wp.duration_minutes)), 0) as weekly_points
 from profiles p
 join workout_posts wp on wp.user_id = p.id
 and wp.workout_date >= week_start
 and wp.workout_date <= current_date
 group by p.id, p.username, p.full_name, p.total_points
 order by weekly_points desc
 limit 100;
$function$;

ALTER FUNCTION public."get_weekly_leaderboard"(week_start date) SET search_path = pg_catalog, public, extensions, pg_temp;

REVOKE ALL ON FUNCTION public."get_weekly_leaderboard"(week_start date) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public."get_weekly_leaderboard"(week_start date) TO service_role;

GRANT EXECUTE ON FUNCTION public."get_weekly_leaderboard"(week_start date) TO authenticated;

CREATE OR REPLACE FUNCTION public.refresh_challenge_statuses()
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
 UPDATE fitness_challenges
 SET status = CASE
 WHEN start_date > current_date THEN 'upcoming'
 WHEN end_date < current_date THEN 'completed'
 ELSE 'active'
 END
 WHERE status != 'completed'
 OR end_date >= current_date - interval '1 day';
$function$;

ALTER FUNCTION public."refresh_challenge_statuses"() SET search_path = pg_catalog, public, extensions, pg_temp;

REVOKE ALL ON FUNCTION public."refresh_challenge_statuses"() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public."refresh_challenge_statuses"() TO service_role;

CREATE OR REPLACE FUNCTION public.award_points_on_workout()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
 v_challenge fitness_challenges%rowtype;
 v_points integer := 0;
begin
 if new.challenge_id is null then return new; end if;

 select * into v_challenge from fitness_challenges where id = new.challenge_id;
 if not found then return new; end if;

 -- workouts: fixed points per workout
 if 'workouts' = any(v_challenge.scoring_modes) then
 v_points := v_points + coalesce(v_challenge.points_per_workout, 1);
 end if;

 -- days_active: 1 point per unique calendar day (first workout of day only)
 if 'days_active' = any(v_challenge.scoring_modes) then
 if not exists (
 select 1 from workout_posts
 where challenge_id = new.challenge_id
 and user_id = new.user_id
 and workout_date = new.workout_date
 and id != new.id
 ) then
 v_points := v_points + 1;
 end if;
 end if;

 -- steps
 if 'steps' = any(v_challenge.scoring_modes) and new.steps is not null then
 v_points := v_points + floor(new.steps / 1000.0 * coalesce(v_challenge.points_per_1000_steps, 1))::integer;
 end if;

 -- distance
 if 'distance_km' = any(v_challenge.scoring_modes) and new.distance_km is not null then
 v_points := v_points + floor(new.distance_km * coalesce(v_challenge.points_per_km, 1))::integer;
 end if;

 -- duration
 if 'duration_min' = any(v_challenge.scoring_modes) and new.duration_minutes is not null then
 v_points := v_points + floor(new.duration_minutes / 30.0 * coalesce(v_challenge.points_per_30min, 1))::integer;
 end if;

 -- Update post points_awarded
 update workout_posts set points_awarded = v_points where id = new.id;

 -- Update participant score
 update challenge_participants
 set score = score + v_points
 where challenge_id = new.challenge_id and user_id = new.user_id;

 -- Refresh ranks
 with ranked as (
 select user_id, rank() over (order by score desc, joined_at asc) as r
 from challenge_participants
 where challenge_id = new.challenge_id
 )
 update challenge_participants cp
 set rank = ranked.r
 from ranked
 where cp.challenge_id = new.challenge_id and cp.user_id = ranked.user_id;

 return new;
end;
$function$;

ALTER FUNCTION public."award_points_on_workout"() SET search_path = pg_catalog, public, extensions, pg_temp;

REVOKE ALL ON FUNCTION public."award_points_on_workout"() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public."award_points_on_workout"() TO service_role;

CREATE OR REPLACE FUNCTION public.process_recurring_challenges()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
 ch RECORD;
 next_start DATE;
 next_end DATE;
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
 next_end := ch.end_date + 7;
 ELSE
 next_start := date_trunc('month', ch.end_date + interval '1 month')::date;
 next_end := (date_trunc('month', ch.end_date + interval '2 months') - interval '1 day')::date;
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
$function$;

ALTER FUNCTION public."process_recurring_challenges"() SET search_path = pg_catalog, public, extensions, pg_temp;

REVOKE ALL ON FUNCTION public."process_recurring_challenges"() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public."process_recurring_challenges"() TO service_role;

CREATE OR REPLACE FUNCTION public.handle_new_profile_streak()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
 insert into user_streaks (user_id) values (new.id) on conflict do nothing;
 return new;
end;
$function$;

ALTER FUNCTION public."handle_new_profile_streak"() SET search_path = pg_catalog, public, extensions, pg_temp;

REVOKE ALL ON FUNCTION public."handle_new_profile_streak"() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public."handle_new_profile_streak"() TO service_role;

CREATE OR REPLACE FUNCTION public.update_streak_on_workout()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
declare
 v_last_date date;
 v_current integer;
 v_longest integer;
 v_qualifies boolean;
begin
 v_qualifies := (
 -- Exercise session >= 20 min (any type that is not purely steps-based)
 (new.activity_type not in ('ganga') AND coalesce(new.duration_minutes, 0) >= 20)
 OR
 -- Legacy 'ganga' step rows >= 7,500 steps
 (new.activity_type = 'ganga' AND coalesce(new.steps, 0) >= 7500)
 OR
 -- 'walk' type used by Health Connect / HealthKit step sync >= 7,500 steps
 (new.activity_type = 'walk' AND coalesce(new.steps, 0) >= 7500)
 );

 if not v_qualifies then
 return new;
 end if;

 select last_active_date, current_streak, longest_streak
 into v_last_date, v_current, v_longest
 from user_streaks
 where user_id = new.user_id;

 if v_last_date is null or v_last_date < new.workout_date - interval '1 day' then
 v_current := 1;
 elsif v_last_date = new.workout_date - interval '1 day' then
 v_current := coalesce(v_current, 0) + 1;
 else
 return new;
 end if;

 v_longest := greatest(coalesce(v_longest, 0), v_current);

 insert into user_streaks (user_id, current_streak, longest_streak, last_active_date, updated_at)
 values (new.user_id, v_current, v_longest, new.workout_date, now())
 on conflict (user_id) do update
 set current_streak = excluded.current_streak,
 longest_streak = excluded.longest_streak,
 last_active_date = excluded.last_active_date,
 updated_at = excluded.updated_at;

 return new;
end;
$function$;

ALTER FUNCTION public."update_streak_on_workout"() SET search_path = pg_catalog, public, extensions, pg_temp;

REVOKE ALL ON FUNCTION public."update_streak_on_workout"() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public."update_streak_on_workout"() TO service_role;

CREATE OR REPLACE FUNCTION public.update_streak_on_step_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
declare
 v_last_date date;
 v_current integer;
 v_longest integer;
begin
 -- Handle both legacy 'ganga' and current 'walk' step rows
 if new.activity_type not in ('ganga', 'walk') then return new; end if;
 if coalesce(new.steps, 0) < 7500 then return new; end if;
 if coalesce(old.steps, 0) >= 7500 then return new; end if; -- already counted today

 select last_active_date, current_streak, longest_streak
 into v_last_date, v_current, v_longest
 from user_streaks
 where user_id = new.user_id;

 if v_last_date is null or v_last_date < new.workout_date::date - interval '1 day' then
 v_current := 1;
 elsif v_last_date = new.workout_date::date - interval '1 day' then
 v_current := coalesce(v_current, 0) + 1;
 else
 return new;
 end if;

 v_longest := greatest(coalesce(v_longest, 0), v_current);

 insert into user_streaks (user_id, current_streak, longest_streak, last_active_date, updated_at)
 values (new.user_id, v_current, v_longest, new.workout_date::date, now())
 on conflict (user_id) do update
 set current_streak = excluded.current_streak,
 longest_streak = excluded.longest_streak,
 last_active_date = excluded.last_active_date,
 updated_at = excluded.updated_at;

 return new;
end;
$function$;

ALTER FUNCTION public."update_streak_on_step_update"() SET search_path = pg_catalog, public, extensions, pg_temp;

REVOKE ALL ON FUNCTION public."update_streak_on_step_update"() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public."update_streak_on_step_update"() TO service_role;

CREATE OR REPLACE FUNCTION public.fan_out_workout_to_challenges()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
 -- Only fan out auto-synced workouts (those with an external_activity_id).
 IF NEW.external_activity_id IS NULL THEN
 RETURN NEW;
 END IF;

 -- Skip fan-out copies themselves — do not fan out a fan-out.
 IF NEW.parent_workout_id IS NOT NULL THEN
 RETURN NEW;
 END IF;

 INSERT INTO workout_posts (
 user_id,
 challenge_id,
 activity_type,
 duration_minutes,
 distance_km,
 calories,
 steps,
 heart_rate_avg,
 heart_rate_max,
 caption,
 media_url,
 media_type,
 workout_date,
 source,
 external_activity_id,
 points_awarded,
 parent_workout_id -- NEW: marks each copy as a fan-out of NEW.id
 )
 SELECT
 NEW.user_id,
 cp.challenge_id,
 NEW.activity_type,
 NEW.duration_minutes,
 NEW.distance_km,
 NEW.calories,
 NEW.steps,
 NEW.heart_rate_avg,
 NEW.heart_rate_max,
 NEW.caption,
 NEW.media_url,
 NEW.media_type,
 NEW.workout_date,
 NEW.source,
 NEW.external_activity_id,
 0, -- points set by award_points_on_workout trigger
 NEW.id -- link back to the originating row
 FROM challenge_participants cp
 JOIN fitness_challenges fc ON fc.id = cp.challenge_id
 WHERE cp.user_id = NEW.user_id
 AND cp.challenge_id != NEW.challenge_id -- exclude the already-inserted row
 AND fc.status = 'active'
 AND NOT EXISTS (
 -- Idempotency guard: skip if already synced to this challenge
 SELECT 1
 FROM workout_posts wp2
 WHERE wp2.user_id = NEW.user_id
 AND wp2.challenge_id = cp.challenge_id
 AND wp2.external_activity_id = NEW.external_activity_id
 );

 RETURN NEW;
END;
$function$;

ALTER FUNCTION public."fan_out_workout_to_challenges"() SET search_path = pg_catalog, public, extensions, pg_temp;

REVOKE ALL ON FUNCTION public."fan_out_workout_to_challenges"() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public."fan_out_workout_to_challenges"() TO service_role;

CREATE OR REPLACE FUNCTION public.use_streak_freeze(p_user_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
 v_affected int;
 v_today date := current_date;
 v_streak user_streaks%rowtype;
BEGIN
 -- SECURITY: caller must be the user whose freeze is being consumed.
 -- Prevents any authenticated user from burning another user's credits.
 IF auth.uid() IS DISTINCT FROM p_user_id THEN
 RAISE EXCEPTION 'unauthorized';
 END IF;

 -- Guard: already used a freeze today — return early without touching credits.
 IF EXISTS (
 SELECT 1 FROM streak_freeze_uses
 WHERE user_id = p_user_id AND freeze_date = v_today
 ) THEN
 RETURN false;
 END IF;

 -- ATOMICITY: decrement credits in a single statement guarded by both
 -- is_pro = true AND credits > 0. If either condition fails, zero rows are
 -- updated and v_affected will be 0. This eliminates the SELECT → check →
 -- UPDATE race window present in the 013 and 022 versions.
 UPDATE profiles
 SET streak_freeze_credits = streak_freeze_credits - 1
 WHERE id = p_user_id
 AND is_pro = true
 AND streak_freeze_credits > 0;

 GET DIAGNOSTICS v_affected = ROW_COUNT;

 IF v_affected = 0 THEN
 -- User is not Pro, or has no credits remaining.
 RETURN false;
 END IF;

 -- Record the freeze day. ON CONFLICT DO NOTHING handles the unlikely
 -- concurrent call that slipped past the EXISTS guard above.
 INSERT INTO streak_freeze_uses (user_id, freeze_date)
 VALUES (p_user_id, v_today)
 ON CONFLICT (user_id, freeze_date) DO NOTHING;

 -- Extend last_active_date to today so tomorrow's workout continues the streak.
 SELECT * INTO v_streak FROM user_streaks WHERE user_id = p_user_id;

 INSERT INTO user_streaks (
 user_id, current_streak, longest_streak, last_active_date, updated_at
 )
 VALUES (
 p_user_id,
 COALESCE(v_streak.current_streak, 1),
 COALESCE(v_streak.longest_streak, 1),
 v_today,
 now()
 )
 ON CONFLICT (user_id) DO UPDATE
 SET last_active_date = v_today,
 updated_at = now();

 RETURN true;
END;
$function$;

ALTER FUNCTION public."use_streak_freeze"(p_user_id uuid) SET search_path = pg_catalog, public, extensions, pg_temp;

REVOKE ALL ON FUNCTION public."use_streak_freeze"(p_user_id uuid) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public."use_streak_freeze"(p_user_id uuid) TO service_role;

GRANT EXECUTE ON FUNCTION public."use_streak_freeze"(p_user_id uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.validate_workout_post()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
declare
 v_manual_count integer;
begin
 if new.steps is not null and (new.steps < 0 or new.steps > 120000) then
 raise exception 'Invalid steps value: must be between 0 and 120000' using errcode = 'P0001';
 end if;
 if new.duration_minutes is not null and (new.duration_minutes < 0 or new.duration_minutes > 1440) then
 raise exception 'Invalid duration: must be between 0 and 1440 minutes' using errcode = 'P0001';
 end if;
 if new.distance_km is not null and (new.distance_km < 0 or new.distance_km > 400) then
 raise exception 'Invalid distance: must be between 0 and 400 km' using errcode = 'P0001';
 end if;
 if new.calories is not null and (new.calories < 0 or new.calories > 20000) then
 raise exception 'Invalid calories: must be between 0 and 20000' using errcode = 'P0001';
 end if;

 -- Rate limit: max 20 manual posts (no external_activity_id) per user per day
 if tg_op = 'INSERT' and new.external_activity_id is null then
 select count(*) into v_manual_count
 from workout_posts
 where user_id = new.user_id
 and workout_date = new.workout_date
 and external_activity_id is null;
 if v_manual_count >= 20 then
 raise exception 'Daily manual workout limit reached (20 per day)' using errcode = 'P0001';
 end if;
 end if;

 return new;
end;
$function$;

ALTER FUNCTION public."validate_workout_post"() SET search_path = pg_catalog, public, extensions, pg_temp;

REVOKE ALL ON FUNCTION public."validate_workout_post"() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public."validate_workout_post"() TO service_role;

CREATE OR REPLACE FUNCTION public.refresh_challenge_ranks(p_challenge_id uuid)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
AS $function$
 with ranked as (
 select user_id, rank() over (order by score desc, joined_at asc) as r
 from challenge_participants
 where challenge_id = p_challenge_id
 )
 update challenge_participants cp
 set rank = ranked.r
 from ranked
 where cp.challenge_id = p_challenge_id and cp.user_id = ranked.user_id;
$function$;

ALTER FUNCTION public."refresh_challenge_ranks"(p_challenge_id uuid) SET search_path = pg_catalog, public, extensions, pg_temp;

REVOKE ALL ON FUNCTION public."refresh_challenge_ranks"(p_challenge_id uuid) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public."refresh_challenge_ranks"(p_challenge_id uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.award_points_on_step_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
declare
 v_challenge fitness_challenges%rowtype;
 v_old_steps integer;
 v_global_delta integer;
 v_challenge_delta integer := 0;
begin
 if new.steps is null then return new; end if;
 v_old_steps := coalesce(old.steps, 0);
 if new.steps = v_old_steps then return new; end if;

 -- Global points delta (mirrors award_global_points_on_workout in 003)
 v_global_delta := floor(new.steps / 1000.0)::integer - floor(v_old_steps / 1000.0)::integer;
 if v_global_delta != 0 then
 update profiles
 set total_points = greatest(coalesce(total_points, 0) + v_global_delta, 0)
 where id = new.user_id;
 end if;

 -- Challenge points delta (mirrors the 'steps' branch of award_points_on_workout in 007)
 if new.challenge_id is not null then
 select * into v_challenge from fitness_challenges where id = new.challenge_id;
 if found and 'steps' = any(v_challenge.scoring_modes) then
 if old.challenge_id is not distinct from new.challenge_id then
 v_challenge_delta :=
 floor(new.steps / 1000.0 * coalesce(v_challenge.points_per_1000_steps, 1))::integer
 - floor(v_old_steps / 1000.0 * coalesce(v_challenge.points_per_1000_steps, 1))::integer;
 else
 -- Row linked to this challenge mid-day: none of its steps counted here yet
 v_challenge_delta :=
 floor(new.steps / 1000.0 * coalesce(v_challenge.points_per_1000_steps, 1))::integer;
 end if;

 if v_challenge_delta != 0 then
 -- Keep points_awarded in sync so delete compensation subtracts the right amount
 update workout_posts
 set points_awarded = coalesce(points_awarded, 0) + v_challenge_delta
 where id = new.id;

 update challenge_participants
 set score = greatest(score + v_challenge_delta, 0)
 where challenge_id = new.challenge_id and user_id = new.user_id;

 perform refresh_challenge_ranks(new.challenge_id);
 end if;
 end if;
 end if;

 return new;
end;
$function$;

ALTER FUNCTION public."award_points_on_step_update"() SET search_path = pg_catalog, public, extensions, pg_temp;

REVOKE ALL ON FUNCTION public."award_points_on_step_update"() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public."award_points_on_step_update"() TO service_role;

CREATE OR REPLACE FUNCTION public.compensate_points_on_workout_delete()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
declare
 v_global integer;
begin
 -- Mirror award_global_points_on_workout (003) exactly
 v_global := 1
 + coalesce(floor(old.steps / 1000.0)::integer, 0)
 + coalesce(floor(old.distance_km)::integer, 0)
 + coalesce(floor(old.duration_minutes / 30.0)::integer, 0);

 update profiles
 set total_points = greatest(coalesce(total_points, 0) - v_global, 0)
 where id = old.user_id;

 if old.challenge_id is not null and coalesce(old.points_awarded, 0) != 0 then
 update challenge_participants
 set score = greatest(score - old.points_awarded, 0)
 where challenge_id = old.challenge_id and user_id = old.user_id;

 perform refresh_challenge_ranks(old.challenge_id);
 end if;

 return old;
end;
$function$;

ALTER FUNCTION public."compensate_points_on_workout_delete"() SET search_path = pg_catalog, public, extensions, pg_temp;

REVOKE ALL ON FUNCTION public."compensate_points_on_workout_delete"() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public."compensate_points_on_workout_delete"() TO service_role;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
declare
 v_base text;
 v_username text;
 v_attempts integer := 0;
begin
 v_base := coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1));
 if v_base is null or length(trim(v_base)) = 0 then
 v_base := 'user';
 end if;

 v_username := v_base;
 while exists (select 1 from profiles where username = v_username) and v_attempts < 10 loop
 v_username := v_base || '_' || substr(md5(random()::text), 1, 4);
 v_attempts := v_attempts + 1;
 end loop;

 begin
 insert into profiles (id, username, full_name)
 values (
 new.id,
 v_username,
 coalesce(new.raw_user_meta_data->>'full_name', '')
 );
 exception when unique_violation then
 -- Lost a race on the username — retry once with a longer random suffix
 insert into profiles (id, username, full_name)
 values (
 new.id,
 v_base || '_' || substr(md5(random()::text), 1, 8),
 coalesce(new.raw_user_meta_data->>'full_name', '')
 );
 end;

 return new;
end;
$function$;

ALTER FUNCTION public."handle_new_user"() SET search_path = pg_catalog, public, extensions, pg_temp;

REVOKE ALL ON FUNCTION public."handle_new_user"() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public."handle_new_user"() TO service_role;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_user();

CREATE TRIGGER on_profile_created_streak AFTER INSERT ON public.profiles FOR EACH ROW EXECUTE FUNCTION handle_new_profile_streak();

CREATE TRIGGER on_workout_post_points AFTER INSERT ON public.workout_posts FOR EACH ROW EXECUTE FUNCTION award_points_on_workout();

CREATE TRIGGER on_workout_post_global_points AFTER INSERT ON public.workout_posts FOR EACH ROW EXECUTE FUNCTION award_global_points_on_workout();

CREATE TRIGGER on_workout_post_achievements AFTER INSERT ON public.workout_posts FOR EACH ROW EXECUTE FUNCTION check_achievements_on_workout();

CREATE TRIGGER enforce_challenge_capacity BEFORE INSERT ON public.challenge_participants FOR EACH ROW EXECUTE FUNCTION check_challenge_capacity();

CREATE TRIGGER on_workout_post_streak AFTER INSERT ON public.workout_posts FOR EACH ROW EXECUTE FUNCTION update_streak_on_workout();

CREATE TRIGGER on_step_update_streak AFTER UPDATE OF steps ON public.workout_posts FOR EACH ROW EXECUTE FUNCTION update_streak_on_step_update();

CREATE TRIGGER auto_sync_workout_fan_out AFTER INSERT ON public.workout_posts FOR EACH ROW EXECUTE FUNCTION fan_out_workout_to_challenges();

CREATE TRIGGER validate_workout_post_trigger BEFORE INSERT OR UPDATE ON public.workout_posts FOR EACH ROW EXECUTE FUNCTION validate_workout_post();

CREATE TRIGGER on_step_update_points AFTER UPDATE OF steps ON public.workout_posts FOR EACH ROW EXECUTE FUNCTION award_points_on_step_update();

CREATE TRIGGER on_workout_post_delete_points AFTER DELETE ON public.workout_posts FOR EACH ROW EXECUTE FUNCTION compensate_points_on_workout_delete();

CREATE TRIGGER guard_device_connection_identity BEFORE UPDATE ON public.device_connections FOR EACH ROW EXECUTE FUNCTION guard_device_connection_identity();

CREATE POLICY "Challenge messages insertable by participants" ON public."challenge_messages" FOR INSERT TO PUBLIC WITH CHECK (((auth.uid() = sender_id) AND (EXISTS ( SELECT 1
 FROM challenge_participants
 WHERE ((challenge_participants.challenge_id = challenge_messages.challenge_id) AND (challenge_participants.user_id = auth.uid()))))));

CREATE POLICY "Challenge messages readable by participants" ON public."challenge_messages" FOR SELECT TO PUBLIC USING ((EXISTS ( SELECT 1
 FROM challenge_participants
 WHERE ((challenge_participants.challenge_id = challenge_messages.challenge_id) AND (challenge_participants.user_id = auth.uid())))));

CREATE POLICY "Participants readable" ON public."challenge_participants" FOR SELECT TO "authenticated" USING (true);

CREATE POLICY "Users join challenges" ON public."challenge_participants" FOR INSERT TO PUBLIC WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "Authenticated users can delete challenge teams" ON public."challenge_teams" FOR DELETE TO PUBLIC USING ((auth.role() = 'authenticated'::text));

CREATE POLICY "Authenticated users can insert challenge teams" ON public."challenge_teams" FOR INSERT TO PUBLIC WITH CHECK ((auth.role() = 'authenticated'::text));

CREATE POLICY "Authenticated users can update challenge teams" ON public."challenge_teams" FOR UPDATE TO PUBLIC USING ((auth.role() = 'authenticated'::text));

CREATE POLICY "Authenticated users can view challenge teams" ON public."challenge_teams" FOR SELECT TO PUBLIC USING ((auth.role() = 'authenticated'::text));

CREATE POLICY "Teams readable" ON public."challenge_teams" FOR SELECT TO "authenticated" USING (true);

CREATE POLICY "Teams writable by service" ON public."challenge_teams" FOR ALL TO PUBLIC USING (((auth.jwt() ->> 'role'::text) = 'service_role'::text)) WITH CHECK (((auth.jwt() ->> 'role'::text) = 'service_role'::text));

CREATE POLICY "Service role full access" ON public."device_connections" FOR ALL TO PUBLIC USING (((auth.jwt() ->> 'role'::text) = 'service_role'::text));

CREATE POLICY "Users delete own connections" ON public."device_connections" FOR DELETE TO PUBLIC USING ((auth.uid() = user_id));

CREATE POLICY "Users insert own connections" ON public."device_connections" FOR INSERT TO PUBLIC WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "Users read own connections" ON public."device_connections" FOR SELECT TO PUBLIC USING ((auth.uid() = user_id));

CREATE POLICY "Users update own connections" ON public."device_connections" FOR UPDATE TO PUBLIC USING ((auth.uid() = user_id));

CREATE POLICY "Authenticated users create challenges" ON public."fitness_challenges" FOR INSERT TO PUBLIC WITH CHECK (((auth.uid() = created_by) AND (is_public = false) AND (is_global = false)));

CREATE POLICY "Creator updates challenge" ON public."fitness_challenges" FOR UPDATE TO PUBLIC USING (((auth.uid() = created_by) AND (is_global = false))) WITH CHECK (((auth.uid() = created_by) AND (is_global = false) AND (is_public = false)));

CREATE POLICY "Public challenges readable" ON public."fitness_challenges" FOR SELECT TO PUBLIC USING (true);

CREATE POLICY "photo_proof_requires_pro" ON public."fitness_challenges" FOR INSERT TO PUBLIC WITH CHECK (((require_photo_proof = false) OR (EXISTS ( SELECT 1
 FROM profiles
 WHERE ((profiles.id = auth.uid()) AND (profiles.is_pro = true))))));

CREATE POLICY "public_challenge_requires_pro" ON public."fitness_challenges" FOR INSERT TO PUBLIC WITH CHECK (((is_public = false) OR (EXISTS ( SELECT 1
 FROM profiles
 WHERE ((profiles.id = auth.uid()) AND (profiles.is_pro = true))))));

CREATE POLICY "Friendships readable" ON public."friendships" FOR SELECT TO "authenticated" USING (true);

CREATE POLICY "Users manage own follows" ON public."friendships" FOR ALL TO PUBLIC USING ((auth.uid() = follower_id));

CREATE POLICY "League groups readable" ON public."league_groups" FOR SELECT TO "authenticated" USING (true);

CREATE POLICY "League groups writable by service" ON public."league_groups" FOR ALL TO PUBLIC USING (((auth.jwt() ->> 'role'::text) = 'service_role'::text)) WITH CHECK (((auth.jwt() ->> 'role'::text) = 'service_role'::text));

CREATE POLICY "Memberships readable" ON public."league_memberships" FOR SELECT TO "authenticated" USING (true);

CREATE POLICY "Memberships writable by service" ON public."league_memberships" FOR ALL TO PUBLIC USING (((auth.jwt() ->> 'role'::text) = 'service_role'::text)) WITH CHECK (((auth.jwt() ->> 'role'::text) = 'service_role'::text));

CREATE POLICY "milestone_reaction_delete" ON public."milestone_reactions" FOR DELETE TO PUBLIC USING ((auth.uid() = user_id));

CREATE POLICY "milestone_reaction_insert" ON public."milestone_reactions" FOR INSERT TO PUBLIC WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "milestone_reaction_read" ON public."milestone_reactions" FOR SELECT TO PUBLIC USING (true);

CREATE POLICY "Users read own notifications" ON public."notifications" FOR SELECT TO PUBLIC USING ((auth.uid() = user_id));

CREATE POLICY "Users update own notifications" ON public."notifications" FOR UPDATE TO PUBLIC USING ((auth.uid() = user_id));

CREATE POLICY "nudge_insert" ON public."nudges" FOR INSERT TO PUBLIC WITH CHECK ((auth.uid() = sender_id));

CREATE POLICY "nudge_select" ON public."nudges" FOR SELECT TO PUBLIC USING (((auth.uid() = receiver_id) OR (auth.uid() = sender_id)));

CREATE POLICY "nudge_update" ON public."nudges" FOR UPDATE TO PUBLIC USING ((auth.uid() = receiver_id));

CREATE POLICY "Public profiles readable" ON public."profiles" FOR SELECT TO PUBLIC USING (true);

CREATE POLICY "Users update own profile" ON public."profiles" FOR UPDATE TO PUBLIC USING ((auth.uid() = id)) WITH CHECK ((auth.uid() = id));

CREATE POLICY "users own freezes" ON public."streak_freeze_uses" FOR ALL TO PUBLIC USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "milestone_insert" ON public."streak_milestones" FOR INSERT TO PUBLIC WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "milestone_read" ON public."streak_milestones" FOR SELECT TO PUBLIC USING (true);

CREATE POLICY "Achievements readable" ON public."user_achievements" FOR SELECT TO "authenticated" USING (true);

CREATE POLICY "Own device token" ON public."user_device_tokens" FOR ALL TO PUBLIC USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "League tiers readable" ON public."user_league_tier" FOR SELECT TO "authenticated" USING (true);

CREATE POLICY "League tiers writable by service" ON public."user_league_tier" FOR ALL TO PUBLIC USING (((auth.jwt() ->> 'role'::text) = 'service_role'::text)) WITH CHECK (((auth.jwt() ->> 'role'::text) = 'service_role'::text));

CREATE POLICY "Streaks readable" ON public."user_streaks" FOR SELECT TO "authenticated" USING ((auth.uid() = user_id));

CREATE POLICY "Comments readable" ON public."workout_comments" FOR SELECT TO PUBLIC USING (true);

CREATE POLICY "Users comment" ON public."workout_comments" FOR INSERT TO PUBLIC WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "Users delete own comments" ON public."workout_comments" FOR DELETE TO PUBLIC USING ((auth.uid() = user_id));

CREATE POLICY "Posts readable" ON public."workout_posts" FOR SELECT TO "authenticated" USING (((auth.uid() = user_id) OR ((challenge_id IS NOT NULL) AND (EXISTS ( SELECT 1
 FROM challenge_participants cp
 WHERE ((cp.challenge_id = workout_posts.challenge_id) AND (cp.user_id = auth.uid()))))) OR ((challenge_id IS NOT NULL) AND (EXISTS ( SELECT 1
 FROM fitness_challenges fc
 WHERE ((fc.id = workout_posts.challenge_id) AND (fc.is_public = true))))) OR (EXISTS ( SELECT 1
 FROM friendships f
 WHERE ((f.follower_id = auth.uid()) AND (f.following_id = workout_posts.user_id))))));

CREATE POLICY "Users create posts" ON public."workout_posts" FOR INSERT TO PUBLIC WITH CHECK (((auth.uid() = user_id) AND ((challenge_id IS NULL) OR (EXISTS ( SELECT 1
 FROM challenge_participants cp
 WHERE ((cp.challenge_id = workout_posts.challenge_id) AND (cp.user_id = auth.uid())))))));

CREATE POLICY "Users delete own posts" ON public."workout_posts" FOR DELETE TO PUBLIC USING ((auth.uid() = user_id));

CREATE POLICY "Users update own posts" ON public."workout_posts" FOR UPDATE TO PUBLIC USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "Reactions readable" ON public."workout_reactions" FOR SELECT TO PUBLIC USING (true);

CREATE POLICY "Users delete own reactions" ON public."workout_reactions" FOR DELETE TO PUBLIC USING ((auth.uid() = user_id));

CREATE POLICY "Users react" ON public."workout_reactions" FOR INSERT TO PUBLIC WITH CHECK ((auth.uid() = user_id));

REVOKE ALL ON TABLE public."challenge_messages" FROM PUBLIC, anon, authenticated;

GRANT ALL ON TABLE public."challenge_messages" TO service_role;

GRANT INSERT, SELECT, UPDATE, DELETE ON TABLE public."challenge_messages" TO authenticated;

REVOKE ALL ON TABLE public."challenge_participants" FROM PUBLIC, anon, authenticated;

GRANT ALL ON TABLE public."challenge_participants" TO service_role;

GRANT INSERT, SELECT, UPDATE, DELETE ON TABLE public."challenge_participants" TO authenticated;

REVOKE ALL ON TABLE public."challenge_teams" FROM PUBLIC, anon, authenticated;

GRANT ALL ON TABLE public."challenge_teams" TO service_role;

GRANT INSERT, SELECT, UPDATE, DELETE ON TABLE public."challenge_teams" TO authenticated;

REVOKE ALL ON TABLE public."daily_mission_templates" FROM PUBLIC, anon, authenticated;

GRANT ALL ON TABLE public."daily_mission_templates" TO service_role;

GRANT INSERT, SELECT, UPDATE, DELETE ON TABLE public."daily_mission_templates" TO authenticated;

REVOKE ALL ON TABLE public."device_connections" FROM PUBLIC, anon, authenticated;

GRANT ALL ON TABLE public."device_connections" TO service_role;

GRANT SELECT, DELETE ON TABLE public."device_connections" TO authenticated;

REVOKE ALL ON TABLE public."fitness_challenges" FROM PUBLIC, anon, authenticated;

GRANT ALL ON TABLE public."fitness_challenges" TO service_role;

GRANT INSERT, SELECT, UPDATE, DELETE ON TABLE public."fitness_challenges" TO authenticated;

REVOKE ALL ON TABLE public."friendships" FROM PUBLIC, anon, authenticated;

GRANT ALL ON TABLE public."friendships" TO service_role;

GRANT INSERT, SELECT, UPDATE, DELETE ON TABLE public."friendships" TO authenticated;

REVOKE ALL ON TABLE public."league_groups" FROM PUBLIC, anon, authenticated;

GRANT ALL ON TABLE public."league_groups" TO service_role;

GRANT INSERT, SELECT, UPDATE, DELETE ON TABLE public."league_groups" TO authenticated;

REVOKE ALL ON TABLE public."league_memberships" FROM PUBLIC, anon, authenticated;

GRANT ALL ON TABLE public."league_memberships" TO service_role;

GRANT INSERT, SELECT, UPDATE, DELETE ON TABLE public."league_memberships" TO authenticated;

REVOKE ALL ON TABLE public."milestone_reactions" FROM PUBLIC, anon, authenticated;

GRANT ALL ON TABLE public."milestone_reactions" TO service_role;

GRANT INSERT, SELECT, UPDATE, DELETE ON TABLE public."milestone_reactions" TO authenticated;

REVOKE ALL ON TABLE public."notifications" FROM PUBLIC, anon, authenticated;

GRANT ALL ON TABLE public."notifications" TO service_role;

GRANT INSERT, SELECT, UPDATE, DELETE ON TABLE public."notifications" TO authenticated;

REVOKE ALL ON TABLE public."nudges" FROM PUBLIC, anon, authenticated;

GRANT ALL ON TABLE public."nudges" TO service_role;

GRANT INSERT, SELECT, UPDATE, DELETE ON TABLE public."nudges" TO authenticated;

REVOKE ALL ON TABLE public."profiles" FROM PUBLIC, anon, authenticated;

GRANT ALL ON TABLE public."profiles" TO service_role;

GRANT INSERT, DELETE ON TABLE public."profiles" TO authenticated;

REVOKE ALL ON TABLE public."streak_freeze_uses" FROM PUBLIC, anon, authenticated;

GRANT ALL ON TABLE public."streak_freeze_uses" TO service_role;

GRANT INSERT, SELECT, UPDATE, DELETE ON TABLE public."streak_freeze_uses" TO authenticated;

REVOKE ALL ON TABLE public."streak_milestones" FROM PUBLIC, anon, authenticated;

GRANT ALL ON TABLE public."streak_milestones" TO service_role;

GRANT INSERT, SELECT, UPDATE, DELETE ON TABLE public."streak_milestones" TO authenticated;

REVOKE ALL ON TABLE public."user_achievements" FROM PUBLIC, anon, authenticated;

GRANT ALL ON TABLE public."user_achievements" TO service_role;

GRANT INSERT, SELECT, UPDATE, DELETE ON TABLE public."user_achievements" TO authenticated;

REVOKE ALL ON TABLE public."user_device_tokens" FROM PUBLIC, anon, authenticated;

GRANT ALL ON TABLE public."user_device_tokens" TO service_role;

GRANT INSERT, SELECT, UPDATE, DELETE ON TABLE public."user_device_tokens" TO authenticated;

REVOKE ALL ON TABLE public."user_league_tier" FROM PUBLIC, anon, authenticated;

GRANT ALL ON TABLE public."user_league_tier" TO service_role;

GRANT INSERT, SELECT, UPDATE, DELETE ON TABLE public."user_league_tier" TO authenticated;

REVOKE ALL ON TABLE public."user_streaks" FROM PUBLIC, anon, authenticated;

GRANT ALL ON TABLE public."user_streaks" TO service_role;

GRANT INSERT, SELECT, UPDATE, DELETE ON TABLE public."user_streaks" TO authenticated;

REVOKE ALL ON TABLE public."workout_comments" FROM PUBLIC, anon, authenticated;

GRANT ALL ON TABLE public."workout_comments" TO service_role;

GRANT INSERT, SELECT, UPDATE, DELETE ON TABLE public."workout_comments" TO authenticated;

REVOKE ALL ON TABLE public."workout_posts" FROM PUBLIC, anon, authenticated;

GRANT ALL ON TABLE public."workout_posts" TO service_role;

GRANT INSERT, SELECT, UPDATE, DELETE ON TABLE public."workout_posts" TO authenticated;

REVOKE ALL ON TABLE public."workout_reactions" FROM PUBLIC, anon, authenticated;

GRANT ALL ON TABLE public."workout_reactions" TO service_role;

GRANT INSERT, SELECT, UPDATE, DELETE ON TABLE public."workout_reactions" TO authenticated;

GRANT SELECT ("avatar_url", "bio", "created_at", "full_name", "id", "is_admin", "is_pro", "pro_expires_at", "streak_freeze_credits", "total_points", "username") ON TABLE public."profiles" TO authenticated;

GRANT UPDATE ("avatar_url", "bio", "full_name", "push_token", "username") ON TABLE public."profiles" TO authenticated;

GRANT INSERT ("is_active", "provider", "user_id") ON TABLE public."device_connections" TO authenticated;

GRANT UPDATE ("is_active", "last_synced_at", "provider", "user_id") ON TABLE public."device_connections" TO authenticated;

REVOKE CREATE ON SCHEMA public FROM PUBLIC, anon, authenticated;

DO $verify$ BEGIN
  IF (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r' AND c.relrowsecurity) <> 22 THEN
    RAISE EXCEPTION 'RLS table count mismatch';
  END IF;
  IF has_column_privilege('authenticated','public.profiles','total_points','UPDATE')
    OR has_column_privilege('authenticated','public.profiles','push_token','SELECT')
    OR has_column_privilege('authenticated','public.device_connections','access_token','UPDATE') THEN
    RAISE EXCEPTION 'Protected column grant regression';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_class c WHERE c.relnamespace='public'::regnamespace AND c.relkind='r'
    AND (has_table_privilege('authenticated',c.oid,'TRUNCATE') OR has_table_privilege('anon',c.oid,'SELECT'))) THEN
    RAISE EXCEPTION 'Unexpected bulk/anonymous privilege';
  END IF;
END $verify$;

SELECT 'BASELINE_REHEARSAL_PASS' AS result;

ROLLBACK;
