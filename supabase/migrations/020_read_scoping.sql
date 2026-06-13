-- StreakWar — Read-path scoping + scoring-formula consolidation
-- Run in Supabase SQL Editor after 019.
--
-- Audit finding (MEDIUM): workout_posts and user_streaks had
-- `for select using (true)` policies, so anyone holding the public anon key
-- could read every user's full workout history (steps, distance, calories,
-- dates, captions, media) and streaks. This migration scopes reads to what
-- the app actually queries:
--   * workout_posts  → own posts, posts in a challenge the viewer is in, or
--                       posts in a public challenge, or posts by someone the
--                       viewer follows. Anonymous access removed.
--   * user_streaks   → own only (every client read is self-scoped; the
--                       leaderboards use SECURITY DEFINER RPCs that bypass RLS).
-- It also removes anonymous read access from the participant/friend/achievement
-- tables, and consolidates the workout-points formula that was copy-pasted in
-- migrations 003 and 004.

-- ════════════════════════════════════════════════════════════════════════════
-- Shared scoring formula (was duplicated verbatim in 003 + 004).
--   points = 1
--          + floor(steps / 1000)
--          + floor(distance_km)
--          + floor(duration_minutes / 30)
-- NULL components contribute 0, matching the original per-field guards.
-- ════════════════════════════════════════════════════════════════════════════

create or replace function workout_points(
  p_steps        integer,
  p_distance_km  numeric,
  p_duration_min integer
) returns integer language sql immutable as $$
  select 1
    + coalesce(floor(p_steps        / 1000.0)::integer, 0)
    + coalesce(floor(p_distance_km           )::integer, 0)
    + coalesce(floor(p_duration_min /   30.0)::integer, 0);
$$;

-- Recreate the global award trigger to call the shared formula (same result).
create or replace function award_global_points_on_workout()
returns trigger language plpgsql security definer as $$
declare
  v_pts integer;
begin
  v_pts := workout_points(new.steps, new.distance_km, new.duration_minutes);
  update profiles
     set total_points = coalesce(total_points, 0) + v_pts
   where id = new.user_id;
  return new;
end;
$$;

-- Recreate the weekly leaderboard to call the shared formula (same columns).
create or replace function get_weekly_leaderboard(week_start date)
returns table (
  id            uuid,
  username      text,
  full_name     text,
  total_points  integer,
  weekly_points bigint
)
language sql security definer as $$
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
$$;

-- ════════════════════════════════════════════════════════════════════════════
-- workout_posts — scoped SELECT.
-- Index supports the per-row challenge-membership EXISTS check below.
-- ════════════════════════════════════════════════════════════════════════════

create index if not exists idx_challenge_participants_challenge_user
  on challenge_participants(challenge_id, user_id);

drop policy if exists "Posts readable" on workout_posts;
create policy "Posts readable" on workout_posts
  for select to authenticated using (
    -- own posts
    auth.uid() = user_id
    -- posts in a challenge the viewer participates in (the global + challenge feed)
    or (challenge_id is not null and exists (
          select 1 from challenge_participants cp
          where cp.challenge_id = workout_posts.challenge_id
            and cp.user_id = auth.uid()
       ))
    -- posts in a public challenge (viewing a challenge before joining)
    or (challenge_id is not null and exists (
          select 1 from fitness_challenges fc
          where fc.id = workout_posts.challenge_id
            and fc.is_public = true
       ))
    -- posts by someone the viewer follows
    or exists (
          select 1 from friendships f
          where f.follower_id = auth.uid()
            and f.following_id = workout_posts.user_id
       )
  );

-- ════════════════════════════════════════════════════════════════════════════
-- user_streaks — own only. Every client read is self-scoped; leaderboards
-- never read this table directly (they use SECURITY DEFINER RPCs).
-- ════════════════════════════════════════════════════════════════════════════

drop policy if exists "Streaks readable" on user_streaks;
create policy "Streaks readable" on user_streaks
  for select to authenticated using (auth.uid() = user_id);

-- ════════════════════════════════════════════════════════════════════════════
-- Drop anonymous read access from the remaining relationship/achievement
-- tables (all app usage is authenticated). These stay broadly readable to
-- authenticated users — participant lists and follow graphs are shown in-app —
-- but are no longer harvestable with the bare anon key.
-- ════════════════════════════════════════════════════════════════════════════

drop policy if exists "Participants readable" on challenge_participants;
create policy "Participants readable" on challenge_participants
  for select to authenticated using (true);

drop policy if exists "Friendships readable" on friendships;
create policy "Friendships readable" on friendships
  for select to authenticated using (true);

drop policy if exists "Achievements readable" on user_achievements;
create policy "Achievements readable" on user_achievements
  for select to authenticated using (true);
