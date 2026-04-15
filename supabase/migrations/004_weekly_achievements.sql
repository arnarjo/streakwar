-- StreakWar – Weekly leaderboard function + Achievements
-- Run in Supabase SQL Editor after 003

-- ── Weekly leaderboard RPC ────────────────────────────────────
-- Returns top-100 users by points earned since the start of the current ISO week (Monday).
-- Uses the same scoring formula as the global trigger:
--   1 pt per workout + 1 per 1 000 steps + 1 per km + 1 per 30 min
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
    coalesce(sum(
      1
      + coalesce(floor(wp.steps         / 1000.0)::integer, 0)
      + coalesce(floor(wp.distance_km             )::integer, 0)
      + coalesce(floor(wp.duration_minutes / 30.0)::integer, 0)
    ), 0) as weekly_points
  from profiles p
  join workout_posts wp on wp.user_id = p.id
    and wp.workout_date >= week_start
    and wp.workout_date <= current_date
  group by p.id, p.username, p.full_name, p.total_points
  order by weekly_points desc
  limit 100;
$$;

-- ── Achievements ──────────────────────────────────────────────
create table if not exists user_achievements (
  id           uuid primary key default uuid_generate_v4(),
  user_id      uuid references profiles(id) on delete cascade not null,
  achievement  text not null,
  earned_at    timestamptz default now(),
  unique(user_id, achievement)
);

alter table user_achievements enable row level security;
drop policy if exists "Achievements readable" on user_achievements;
create policy "Achievements readable" on user_achievements for select using (true);

create index if not exists idx_user_achievements_user on user_achievements(user_id);

-- ── Achievement trigger ───────────────────────────────────────
-- Fires after each workout insert and checks whether the user just
-- unlocked any milestone. Uses ON CONFLICT DO NOTHING so milestones
-- are awarded exactly once.
create or replace function check_achievements_on_workout()
returns trigger language plpgsql security definer as $$
declare
  v_workout_count integer;
  v_total_points  integer;
  v_streak        integer;
  v_total_steps   bigint;
begin
  -- Fetch current stats
  select count(*)         into v_workout_count from workout_posts where user_id = new.user_id;
  select total_points     into v_total_points  from profiles       where id      = new.user_id;
  select current_streak   into v_streak        from user_streaks   where user_id = new.user_id;
  select coalesce(sum(steps), 0)
                          into v_total_steps   from workout_posts where user_id = new.user_id and steps is not null;

  -- First workout ever
  if v_workout_count = 1 then
    insert into user_achievements (user_id, achievement)
    values (new.user_id, 'first_workout') on conflict do nothing;
  end if;

  -- Workout count milestones
  if v_workout_count >= 10  then insert into user_achievements (user_id, achievement) values (new.user_id, 'workouts_10')  on conflict do nothing; end if;
  if v_workout_count >= 50  then insert into user_achievements (user_id, achievement) values (new.user_id, 'workouts_50')  on conflict do nothing; end if;
  if v_workout_count >= 100 then insert into user_achievements (user_id, achievement) values (new.user_id, 'workouts_100') on conflict do nothing; end if;

  -- Points milestones
  if v_total_points >= 100  then insert into user_achievements (user_id, achievement) values (new.user_id, 'pts_100')  on conflict do nothing; end if;
  if v_total_points >= 500  then insert into user_achievements (user_id, achievement) values (new.user_id, 'pts_500')  on conflict do nothing; end if;
  if v_total_points >= 1000 then insert into user_achievements (user_id, achievement) values (new.user_id, 'pts_1000') on conflict do nothing; end if;
  if v_total_points >= 5000 then insert into user_achievements (user_id, achievement) values (new.user_id, 'pts_5000') on conflict do nothing; end if;

  -- Streak milestones
  if v_streak >= 3   then insert into user_achievements (user_id, achievement) values (new.user_id, 'streak_3')   on conflict do nothing; end if;
  if v_streak >= 7   then insert into user_achievements (user_id, achievement) values (new.user_id, 'streak_7')   on conflict do nothing; end if;
  if v_streak >= 14  then insert into user_achievements (user_id, achievement) values (new.user_id, 'streak_14')  on conflict do nothing; end if;
  if v_streak >= 30  then insert into user_achievements (user_id, achievement) values (new.user_id, 'streak_30')  on conflict do nothing; end if;
  if v_streak >= 100 then insert into user_achievements (user_id, achievement) values (new.user_id, 'streak_100') on conflict do nothing; end if;

  -- Steps milestone
  if v_total_steps >= 100000 then insert into user_achievements (user_id, achievement) values (new.user_id, 'steps_100k') on conflict do nothing; end if;

  return new;
end;
$$;

drop trigger if exists on_workout_post_achievements on workout_posts;
create trigger on_workout_post_achievements
  after insert on workout_posts
  for each row execute procedure check_achievements_on_workout();
