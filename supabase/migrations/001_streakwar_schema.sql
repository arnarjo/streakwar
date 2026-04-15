-- StreakWar – Database Schema
-- Run this in your Supabase SQL editor

-- ── Enable extensions ─────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ── Profiles ──────────────────────────────────────────────
create table if not exists profiles (
  id            uuid references auth.users on delete cascade primary key,
  username      text unique not null,
  full_name     text,
  avatar_url    text,
  bio           text,
  is_admin      boolean default false,
  push_token    text,
  created_at    timestamptz default now()
);

-- Auto-create profile on signup
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into profiles (id, username, full_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'full_name', '')
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- ── Fitness Challenges ────────────────────────────────────
create table if not exists fitness_challenges (
  id                    uuid primary key default uuid_generate_v4(),
  name                  text not null,
  description           text,
  cover_image_url       text,
  created_by            uuid references profiles(id) not null,
  start_date            date not null,
  end_date              date not null,
  status                text check (status in ('upcoming','active','completed')) default 'upcoming',

  -- Scoring
  scoring_modes         text[] not null default '{"workouts"}',
  points_per_workout    integer default 1,
  points_per_1000_steps integer default 1,
  points_per_km         numeric default 1,
  points_per_30min      integer default 1,
  custom_scoring        jsonb,

  -- Rules
  backlog_days_allowed  integer default 7,
  require_photo_proof   boolean default false,
  is_teams_mode         boolean default false,
  tie_break_rule        text check (tie_break_rule in ('first_to_score','most_recent_activity','most_workouts')) not null default 'most_recent_activity',
  is_public             boolean default false,
  invite_code           text unique default upper(substr(md5(random()::text), 1, 8)),

  created_at            timestamptz default now()
);

-- Auto-update challenge status via pg_cron (schedule separately):
-- SELECT cron.schedule('update-challenge-status', '*/15 * * * *',
--   $$UPDATE fitness_challenges SET status = CASE
--     WHEN start_date > current_date THEN 'upcoming'
--     WHEN end_date < current_date THEN 'completed'
--     ELSE 'active'
--   END WHERE status != 'completed' OR end_date >= current_date - interval '1 day';$$);

-- ── Challenge Participants ─────────────────────────────────
create table if not exists challenge_participants (
  id           uuid primary key default uuid_generate_v4(),
  challenge_id uuid references fitness_challenges(id) on delete cascade not null,
  user_id      uuid references profiles(id) on delete cascade not null,
  team_id      uuid,
  score        integer default 0,
  rank         integer,
  joined_at    timestamptz default now(),
  unique(challenge_id, user_id)
);

-- ── Challenge Teams ────────────────────────────────────────
create table if not exists challenge_teams (
  id           uuid primary key default uuid_generate_v4(),
  challenge_id uuid references fitness_challenges(id) on delete cascade not null,
  name         text not null,
  score        integer default 0
);

-- ── Workout Posts ──────────────────────────────────────────
create table if not exists workout_posts (
  id                   uuid primary key default uuid_generate_v4(),
  user_id              uuid references profiles(id) on delete cascade not null,
  challenge_id         uuid references fitness_challenges(id) on delete set null,

  activity_type        text not null,
  duration_minutes     numeric,
  distance_km          numeric,
  calories             integer,
  steps                integer,

  source               text check (source in ('manual','apple_health','health_connect','strava','garmin','fitbit','samsung_health')) default 'manual',
  external_activity_id text,

  caption              text,
  media_url            text,
  media_type           text check (media_type in ('photo','video')),

  points_awarded       integer default 0,
  workout_date         date not null default current_date,
  posted_at            timestamptz default now()
);

-- Prevent duplicate imports from external sources
create unique index if not exists workout_posts_dedup
  on workout_posts(user_id, source, external_activity_id)
  where external_activity_id is not null;

-- ── Workout Reactions ──────────────────────────────────────
create table if not exists workout_reactions (
  id         uuid primary key default uuid_generate_v4(),
  post_id    uuid references workout_posts(id) on delete cascade not null,
  user_id    uuid references profiles(id) on delete cascade not null,
  reaction   text not null,
  created_at timestamptz default now(),
  unique(post_id, user_id, reaction)
);

-- ── Workout Comments ───────────────────────────────────────
create table if not exists workout_comments (
  id         uuid primary key default uuid_generate_v4(),
  post_id    uuid references workout_posts(id) on delete cascade not null,
  user_id    uuid references profiles(id) on delete cascade not null,
  content    text not null,
  created_at timestamptz default now()
);

-- ── User Streaks ───────────────────────────────────────────
create table if not exists user_streaks (
  user_id          uuid references profiles(id) on delete cascade primary key,
  current_streak   integer default 0,
  longest_streak   integer default 0,
  last_active_date date,
  updated_at       timestamptz default now()
);

-- Auto-create streak row for new profiles
create or replace function handle_new_profile_streak()
returns trigger language plpgsql security definer as $$
begin
  insert into user_streaks (user_id) values (new.id) on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists on_profile_created_streak on profiles;
create trigger on_profile_created_streak
  after insert on profiles
  for each row execute procedure handle_new_profile_streak();

-- Update streak when workout is posted
create or replace function update_streak_on_workout()
returns trigger language plpgsql security definer as $$
declare
  v_last_date date;
  v_current   integer;
  v_longest   integer;
begin
  select last_active_date, current_streak, longest_streak
    into v_last_date, v_current, v_longest
    from user_streaks
   where user_id = new.user_id;

  if v_last_date is null or v_last_date < new.workout_date - interval '1 day' then
    -- Gap > 1 day: reset streak
    v_current := 1;
  elsif v_last_date = new.workout_date - interval '1 day' then
    -- Consecutive day
    v_current := coalesce(v_current, 0) + 1;
  else
    -- Same day: no change
    return new;
  end if;

  v_longest := greatest(coalesce(v_longest, 0), v_current);

  insert into user_streaks (user_id, current_streak, longest_streak, last_active_date, updated_at)
  values (new.user_id, v_current, v_longest, new.workout_date, now())
  on conflict (user_id) do update
    set current_streak   = excluded.current_streak,
        longest_streak   = excluded.longest_streak,
        last_active_date = excluded.last_active_date,
        updated_at       = excluded.updated_at;

  return new;
end;
$$;

drop trigger if exists on_workout_post_streak on workout_posts;
create trigger on_workout_post_streak
  after insert on workout_posts
  for each row execute procedure update_streak_on_workout();

-- Award points and update participant score when workout posted
create or replace function award_points_on_workout()
returns trigger language plpgsql security definer as $$
declare
  v_challenge fitness_challenges%rowtype;
  v_points    integer := 0;
begin
  if new.challenge_id is null then return new; end if;

  select * into v_challenge from fitness_challenges where id = new.challenge_id;
  if not found then return new; end if;

  -- Calculate points based on scoring modes
  if 'workouts' = any(v_challenge.scoring_modes) then
    v_points := v_points + coalesce(v_challenge.points_per_workout, 1);
  end if;
  if 'steps' = any(v_challenge.scoring_modes) and new.steps is not null then
    v_points := v_points + floor(new.steps / 1000.0 * coalesce(v_challenge.points_per_1000_steps, 1))::integer;
  end if;
  if 'distance_km' = any(v_challenge.scoring_modes) and new.distance_km is not null then
    v_points := v_points + floor(new.distance_km * coalesce(v_challenge.points_per_km, 1))::integer;
  end if;
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
$$;

drop trigger if exists on_workout_post_points on workout_posts;
create trigger on_workout_post_points
  after insert on workout_posts
  for each row execute procedure award_points_on_workout();

-- ── Notifications ──────────────────────────────────────────
create table if not exists notifications (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid references profiles(id) on delete cascade not null,
  type       text not null,
  title      text not null,
  body       text not null,
  data       jsonb,
  read       boolean default false,
  created_at timestamptz default now()
);

-- ── Storage buckets ────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('workout-media', 'workout-media', true)
on conflict do nothing;

-- ── Row Level Security ─────────────────────────────────────

-- Profiles
alter table profiles enable row level security;
drop policy if exists "Public profiles readable" on profiles;
drop policy if exists "Users update own profile" on profiles;
create policy "Public profiles readable" on profiles for select using (true);
create policy "Users update own profile" on profiles for update using (auth.uid() = id);

-- Fitness challenges
alter table fitness_challenges enable row level security;
drop policy if exists "Public challenges readable" on fitness_challenges;
drop policy if exists "Authenticated users create challenges" on fitness_challenges;
drop policy if exists "Creator updates challenge" on fitness_challenges;
create policy "Public challenges readable" on fitness_challenges for select using (true);
create policy "Authenticated users create challenges" on fitness_challenges for insert with check (auth.uid() = created_by);
create policy "Creator updates challenge" on fitness_challenges for update using (auth.uid() = created_by);

-- Challenge participants
alter table challenge_participants enable row level security;
drop policy if exists "Participants readable" on challenge_participants;
drop policy if exists "Users join challenges" on challenge_participants;
create policy "Participants readable" on challenge_participants for select using (true);
create policy "Users join challenges" on challenge_participants for insert with check (auth.uid() = user_id);

-- Workout posts
alter table workout_posts enable row level security;
drop policy if exists "Posts readable" on workout_posts;
drop policy if exists "Users create posts" on workout_posts;
drop policy if exists "Users delete own posts" on workout_posts;
create policy "Posts readable" on workout_posts for select using (true);
create policy "Users create posts" on workout_posts for insert with check (auth.uid() = user_id);
create policy "Users delete own posts" on workout_posts for delete using (auth.uid() = user_id);

-- Workout reactions
alter table workout_reactions enable row level security;
drop policy if exists "Reactions readable" on workout_reactions;
drop policy if exists "Users react" on workout_reactions;
drop policy if exists "Users delete own reactions" on workout_reactions;
create policy "Reactions readable" on workout_reactions for select using (true);
create policy "Users react" on workout_reactions for insert with check (auth.uid() = user_id);
create policy "Users delete own reactions" on workout_reactions for delete using (auth.uid() = user_id);

-- Workout comments
alter table workout_comments enable row level security;
drop policy if exists "Comments readable" on workout_comments;
drop policy if exists "Users comment" on workout_comments;
drop policy if exists "Users delete own comments" on workout_comments;
create policy "Comments readable" on workout_comments for select using (true);
create policy "Users comment" on workout_comments for insert with check (auth.uid() = user_id);
create policy "Users delete own comments" on workout_comments for delete using (auth.uid() = user_id);

-- User streaks
alter table user_streaks enable row level security;
drop policy if exists "Streaks readable" on user_streaks;
create policy "Streaks readable" on user_streaks for select using (true);

-- Notifications
alter table notifications enable row level security;
drop policy if exists "Users read own notifications" on notifications;
drop policy if exists "Users update own notifications" on notifications;
create policy "Users read own notifications" on notifications for select using (auth.uid() = user_id);
create policy "Users update own notifications" on notifications for update using (auth.uid() = user_id);

-- Storage
drop policy if exists "Authenticated users upload media" on storage.objects;
drop policy if exists "Media publicly readable" on storage.objects;
create policy "Authenticated users upload media"
  on storage.objects for insert
  with check (bucket_id = 'workout-media' and auth.role() = 'authenticated');
create policy "Media publicly readable"
  on storage.objects for select
  using (bucket_id = 'workout-media');

-- ── Indexes ────────────────────────────────────────────────
create index if not exists idx_workout_posts_user_id on workout_posts(user_id);
create index if not exists idx_workout_posts_challenge_id on workout_posts(challenge_id);
create index if not exists idx_workout_posts_posted_at on workout_posts(posted_at desc);
create index if not exists idx_challenge_participants_user_id on challenge_participants(user_id);
create index if not exists idx_challenge_participants_challenge_id on challenge_participants(challenge_id);
create index if not exists idx_fitness_challenges_is_public on fitness_challenges(is_public) where is_public = true;
create index if not exists idx_notifications_user_id on notifications(user_id);
