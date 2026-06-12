-- StreakWar – Security hardening (audit fixes)
-- Run in Supabase SQL Editor after 018
--
-- 1.  profiles: column-level UPDATE grants (block self-promotion to admin/pro/points)
-- 2.  leagues: drop world-writable policies, service-role-only writes
-- 3.  challenge_teams: enable RLS
-- 4.  workout_posts: input validation + manual-post rate limit
-- 5.  workout_posts: AFTER DELETE point compensation
-- 6.  workout_posts: AFTER UPDATE OF steps point delta (mirrors 015/017 streak fix)
-- 7.  workout_posts: missing UPDATE policy
-- 8.  handle_new_user: username collision handling
-- 9.  profiles: column-level SELECT grants (hide push_token)
-- 10. league_groups: idempotency constraint for weekly reset

-- ════════════════════════════════════════════════════════════════════════════
-- 1. profiles — protected columns via column-level UPDATE grants
--    Clients may only write: username, full_name, avatar_url, bio, push_token.
--    total_points / is_admin / is_pro / pro_expires_at / streak_freeze_credits
--    are written exclusively by SECURITY DEFINER triggers, pg_cron jobs and
--    service-role edge functions (revenuecat-webhook), all of which are
--    unaffected by these grants.
-- ════════════════════════════════════════════════════════════════════════════

revoke update on public.profiles from authenticated, anon;
grant update (username, full_name, avatar_url, bio, push_token)
  on public.profiles to authenticated;

-- Add the missing WITH CHECK so a user cannot re-point a row at another id
drop policy if exists "Users update own profile" on profiles;
create policy "Users update own profile" on profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- ════════════════════════════════════════════════════════════════════════════
-- 9. profiles — column-level SELECT grants (push_token no longer harvestable)
--    Edge functions use the service_role key (full table grant, bypasses RLS)
--    and keep reading push_token.
-- ════════════════════════════════════════════════════════════════════════════

revoke select on public.profiles from authenticated, anon;
grant select (
  id, username, full_name, avatar_url, bio, is_admin, created_at,
  total_points, is_pro, pro_expires_at, streak_freeze_credits
) on public.profiles to authenticated, anon;

-- ════════════════════════════════════════════════════════════════════════════
-- 2. Leagues — drop world-writable policies, writes are service-role only
--    (mirrors 002_device_connections.sql "Service role full access")
-- ════════════════════════════════════════════════════════════════════════════

-- user_league_tier
drop policy if exists "League tiers writable by service" on user_league_tier;
drop policy if exists "League tiers readable" on user_league_tier;
create policy "League tiers readable" on user_league_tier
  for select to authenticated using (true);
create policy "League tiers writable by service" on user_league_tier
  for all using (auth.jwt() ->> 'role' = 'service_role')
  with check (auth.jwt() ->> 'role' = 'service_role');

-- league_memberships
drop policy if exists "Memberships writable by service" on league_memberships;
drop policy if exists "Memberships readable" on league_memberships;
create policy "Memberships readable" on league_memberships
  for select to authenticated using (true);
create policy "Memberships writable by service" on league_memberships
  for all using (auth.jwt() ->> 'role' = 'service_role')
  with check (auth.jwt() ->> 'role' = 'service_role');

-- league_groups (005 only created a SELECT policy — make writes explicit too)
drop policy if exists "League groups writable by service" on league_groups;
drop policy if exists "League groups readable" on league_groups;
create policy "League groups readable" on league_groups
  for select to authenticated using (true);
create policy "League groups writable by service" on league_groups
  for all using (auth.jwt() ->> 'role' = 'service_role')
  with check (auth.jwt() ->> 'role' = 'service_role');

-- ════════════════════════════════════════════════════════════════════════════
-- 3. challenge_teams — RLS was never enabled in 001.
--    No client code reads or writes this table today (verified via grep),
--    so: readable by authenticated users, writes service-role only.
-- ════════════════════════════════════════════════════════════════════════════

alter table challenge_teams enable row level security;
drop policy if exists "Teams readable" on challenge_teams;
drop policy if exists "Teams writable by service" on challenge_teams;
create policy "Teams readable" on challenge_teams
  for select to authenticated using (true);
create policy "Teams writable by service" on challenge_teams
  for all using (auth.jwt() ->> 'role' = 'service_role')
  with check (auth.jwt() ->> 'role' = 'service_role');

-- ════════════════════════════════════════════════════════════════════════════
-- 7. workout_posts — missing UPDATE policy (client updateWorkout silently
--    matched 0 rows; the Health Connect daily-steps UPDATE was also a no-op)
-- ════════════════════════════════════════════════════════════════════════════

drop policy if exists "Users update own posts" on workout_posts;
create policy "Users update own posts" on workout_posts
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ════════════════════════════════════════════════════════════════════════════
-- 4. workout_posts — input validation + manual-post rate limit
-- ════════════════════════════════════════════════════════════════════════════

create or replace function validate_workout_post()
returns trigger language plpgsql security definer as $$
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
$$;

drop trigger if exists validate_workout_post_trigger on workout_posts;
create trigger validate_workout_post_trigger
  before insert or update on workout_posts
  for each row execute function validate_workout_post();

-- ════════════════════════════════════════════════════════════════════════════
-- Helper — rank refresh shared by the new triggers (same CTE used by
-- award_points_on_workout in 001/007)
-- ════════════════════════════════════════════════════════════════════════════

create or replace function refresh_challenge_ranks(p_challenge_id uuid)
returns void language sql security definer as $$
  with ranked as (
    select user_id, rank() over (order by score desc, joined_at asc) as r
      from challenge_participants
     where challenge_id = p_challenge_id
  )
  update challenge_participants cp
     set rank = ranked.r
    from ranked
   where cp.challenge_id = p_challenge_id and cp.user_id = ranked.user_id;
$$;

-- ════════════════════════════════════════════════════════════════════════════
-- 6. Steps points were frozen at first sync: the daily steps row is INSERTed
--    once and then UPDATEd as the count grows (src/lib/healthConnect.ts), but
--    both award triggers fire on INSERT only. Mirror the 015/017 streak fix:
--    an AFTER UPDATE OF steps trigger that awards only the points DELTA.
--
--    Global formula (003): 1 pt per 1,000 steps  → delta of floor(steps/1000)
--    Challenge formula (007, 'steps' mode): floor(steps/1000 * points_per_1000_steps)
--    points_awarded is bumped by the challenge delta so the delete-compensation
--    trigger (below) stays exact.
-- ════════════════════════════════════════════════════════════════════════════

create or replace function award_points_on_step_update()
returns trigger language plpgsql security definer as $$
declare
  v_challenge       fitness_challenges%rowtype;
  v_old_steps       integer;
  v_global_delta    integer;
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
            floor(new.steps  / 1000.0 * coalesce(v_challenge.points_per_1000_steps, 1))::integer
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
$$;

drop trigger if exists on_step_update_points on workout_posts;
create trigger on_step_update_points
  after update of steps on workout_posts
  for each row execute function award_points_on_step_update();

-- ════════════════════════════════════════════════════════════════════════════
-- 5. Delete compensation — workout_posts has a DELETE policy but points were
--    never reclaimed, so deleting+reposting inflated scores forever.
--
--    Global (003 formula, recomputed from the row's final values):
--      1 + floor(steps/1000) + floor(distance_km) + floor(duration_minutes/30)
--    Challenge: the exact amount this row awarded is stored in points_awarded
--      (written by award_points_on_workout at insert and kept current by the
--      step-delta trigger above).
--    Weekly points need no compensation: they are computed on the fly from
--      workout_posts by get_weekly_leaderboard / get_league_group_leaderboard.
-- ════════════════════════════════════════════════════════════════════════════

create or replace function compensate_points_on_workout_delete()
returns trigger language plpgsql security definer as $$
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
$$;

drop trigger if exists on_workout_post_delete_points on workout_posts;
create trigger on_workout_post_delete_points
  after delete on workout_posts
  for each row execute function compensate_points_on_workout_delete();

-- ════════════════════════════════════════════════════════════════════════════
-- 8. handle_new_user — username is UNIQUE but was derived from the email
--    prefix with no collision handling, so the second "john@…" signup failed.
--    Append a short random suffix until the name is free.
-- ════════════════════════════════════════════════════════════════════════════

create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
declare
  v_base     text;
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
$$;

-- ════════════════════════════════════════════════════════════════════════════
-- 10. League reset idempotency.
--     NOTE: a plain unique(tier, week_start) would break the by-design
--     bucketing of >20 users per tier into multiple groups per week
--     (weekly-league-reset creates one league_groups row per 20-user chunk).
--     A group_index column is added instead so each (tier, week_start,
--     group_index) is unique — re-runs conflict and are ignored, while
--     multiple buckets per tier remain possible. Existing duplicate rows are
--     backfilled with sequential indexes before the unique index is created.
-- ════════════════════════════════════════════════════════════════════════════

alter table league_groups
  add column if not exists group_index integer not null default 1;

do $$
begin
  with numbered as (
    select id, row_number() over (partition by tier, week_start order by created_at, id) as rn
      from league_groups
  )
  update league_groups lg
     set group_index = numbered.rn
    from numbered
   where lg.id = numbered.id
     and lg.group_index is distinct from numbered.rn;
end;
$$;

create unique index if not exists uq_league_groups_tier_week_index
  on league_groups(tier, week_start, group_index);
