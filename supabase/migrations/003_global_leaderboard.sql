-- StreakWar – Global leaderboard & friends
-- Run this in Supabase SQL Editor after 001 and 002

-- ── Global points on profiles ─────────────────────────────────
alter table profiles add column if not exists total_points integer not null default 0;

create index if not exists idx_profiles_total_points on profiles(total_points desc);

-- ── Trigger: award global points whenever a workout is inserted ──
-- Scoring: 1 pt per workout + 1 per 1 000 steps + 1 per km + 1 per 30 min
create or replace function award_global_points_on_workout()
returns trigger language plpgsql security definer as $$
declare
  v_pts integer := 1;
begin
  if new.steps is not null then
    v_pts := v_pts + floor(new.steps / 1000.0)::integer;
  end if;
  if new.distance_km is not null then
    v_pts := v_pts + floor(new.distance_km)::integer;
  end if;
  if new.duration_minutes is not null then
    v_pts := v_pts + floor(new.duration_minutes / 30.0)::integer;
  end if;

  update profiles
     set total_points = coalesce(total_points, 0) + v_pts
   where id = new.user_id;

  return new;
end;
$$;

drop trigger if exists on_workout_post_global_points on workout_posts;
create trigger on_workout_post_global_points
  after insert on workout_posts
  for each row execute procedure award_global_points_on_workout();

-- ── Friendships (follow model) ────────────────────────────────
create table if not exists friendships (
  id           uuid primary key default uuid_generate_v4(),
  follower_id  uuid references profiles(id) on delete cascade not null,
  following_id uuid references profiles(id) on delete cascade not null,
  created_at   timestamptz default now(),
  unique(follower_id, following_id),
  check (follower_id != following_id)
);

alter table friendships enable row level security;
drop policy if exists "Friendships readable" on friendships;
drop policy if exists "Users manage own follows" on friendships;
create policy "Friendships readable" on friendships for select using (true);
create policy "Users manage own follows" on friendships
  for all using (auth.uid() = follower_id);

create index if not exists idx_friendships_follower  on friendships(follower_id);
create index if not exists idx_friendships_following on friendships(following_id);
