-- StreakWar – Device connections & health sync

-- ── Device connections ────────────────────────────────────────
-- Tracks which health sources a user has connected and their sync state.
create table if not exists device_connections (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid references profiles(id) on delete cascade not null,
  provider        text not null,
  -- providers: apple_health | health_connect | strava | garmin | fitbit | samsung_health
  is_active       boolean default true,
  access_token    text,           -- encrypted OAuth token (Strava/Garmin/Fitbit)
  refresh_token   text,           -- refresh token for OAuth providers
  token_expires_at timestamptz,
  external_user_id text,          -- provider's user id (used for webhook routing)
  last_synced_at  timestamptz,
  created_at      timestamptz default now(),
  unique(user_id, provider)
);

-- RLS
alter table device_connections enable row level security;
drop policy if exists "Users read own connections" on device_connections;
drop policy if exists "Users insert own connections" on device_connections;
drop policy if exists "Users update own connections" on device_connections;
drop policy if exists "Users delete own connections" on device_connections;
drop policy if exists "Service role full access" on device_connections;
create policy "Users read own connections" on device_connections
  for select using (auth.uid() = user_id);
create policy "Users insert own connections" on device_connections
  for insert with check (auth.uid() = user_id);
create policy "Users update own connections" on device_connections
  for update using (auth.uid() = user_id);
create policy "Users delete own connections" on device_connections
  for delete using (auth.uid() = user_id);
-- Service role (Edge Functions) can read/write all rows
create policy "Service role full access" on device_connections
  for all using (auth.jwt() ->> 'role' = 'service_role');

-- Index for webhook routing (look up user by external_user_id + provider)
create index if not exists idx_device_connections_external_id
  on device_connections(provider, external_user_id)
  where is_active = true;

-- Deduplication index on workout_posts: same source + same external id = same workout
-- Add external_activity_id column if it doesn't exist yet
alter table workout_posts add column if not exists
  external_activity_id text;

create unique index if not exists idx_workout_posts_external_dedup
  on workout_posts(user_id, external_activity_id)
  where external_activity_id is not null;

-- Index to efficiently query recent workouts by user (used by sync functions)
create index if not exists idx_workout_posts_workout_date
  on workout_posts(user_id, workout_date desc);
