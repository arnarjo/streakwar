-- StreakWar – League system
-- Run in Supabase SQL Editor after 004

-- ── Tier enum ─────────────────────────────────────────────────
do $$ begin
  create type league_tier as enum ('bronze', 'silver', 'gold', 'platinum', 'diamond');
exception when duplicate_object then null; end $$;

-- ── Current tier per user ─────────────────────────────────────
create table if not exists user_league_tier (
  user_id    uuid primary key references profiles(id) on delete cascade,
  tier       league_tier not null default 'bronze',
  updated_at timestamptz default now()
);

alter table user_league_tier enable row level security;
drop policy if exists "League tiers readable" on user_league_tier;
create policy "League tiers readable" on user_league_tier for select using (true);
drop policy if exists "League tiers writable by service" on user_league_tier;
create policy "League tiers writable by service" on user_league_tier
  for all using (true) with check (true);

-- ── League groups (20-person buckets per week) ────────────────
create table if not exists league_groups (
  id         uuid primary key default uuid_generate_v4(),
  tier       league_tier not null,
  week_start date not null,
  created_at timestamptz default now()
);

alter table league_groups enable row level security;
drop policy if exists "League groups readable" on league_groups;
create policy "League groups readable" on league_groups for select using (true);

-- ── Who is in which group ─────────────────────────────────────
create table if not exists league_memberships (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references profiles(id) on delete cascade not null,
  group_id    uuid references league_groups(id) on delete cascade not null,
  week_start  date not null,
  final_rank  integer,
  promoted    boolean default false,
  relegated   boolean default false,
  unique(user_id, week_start)
);

alter table league_memberships enable row level security;
drop policy if exists "Memberships readable" on league_memberships;
create policy "Memberships readable" on league_memberships for select using (true);
drop policy if exists "Memberships writable by service" on league_memberships;
create policy "Memberships writable by service" on league_memberships
  for all using (true) with check (true);

create index if not exists idx_memberships_user_week on league_memberships(user_id, week_start);
create index if not exists idx_memberships_group on league_memberships(group_id, week_start);

-- ── RPC: Get leaderboard for a league group ───────────────────
create or replace function get_league_group_leaderboard(p_group_id uuid, p_week_start date)
returns table (
  user_id       uuid,
  username      text,
  full_name     text,
  tier          text,
  weekly_points bigint
)
language sql security definer as $$
  select
    p.id as user_id,
    p.username,
    p.full_name,
    ult.tier::text,
    coalesce(sum(
      1
      + coalesce(floor(wp.steps          / 1000.0)::integer, 0)
      + coalesce(floor(wp.distance_km              )::integer, 0)
      + coalesce(floor(wp.duration_minutes / 30.0 )::integer, 0)
    ), 0) as weekly_points
  from league_memberships lm
  join profiles p on p.id = lm.user_id
  left join user_league_tier ult on ult.user_id = p.id
  left join workout_posts wp
    on  wp.user_id = p.id
    and wp.workout_date >= p_week_start
    and wp.workout_date <= current_date
  where lm.group_id = p_group_id
    and lm.week_start = p_week_start
  group by p.id, p.username, p.full_name, ult.tier
  order by weekly_points desc;
$$;
