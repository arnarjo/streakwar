-- Pro features: streak freeze + public challenge gate

-- 1. Streak freeze credits on profiles (Pro users get 1/month)
alter table profiles
  add column if not exists streak_freeze_credits int not null default 0;

-- 2. Track which days a user has used a freeze
create table if not exists streak_freeze_uses (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references profiles(id) on delete cascade not null,
  freeze_date date not null,
  created_at  timestamptz default now(),
  unique(user_id, freeze_date)
);

alter table streak_freeze_uses enable row level security;
create policy "users own freezes" on streak_freeze_uses
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 3. RPC: use a freeze — extends last_active_date to today so streak doesn't break
create or replace function use_streak_freeze(p_user_id uuid)
returns boolean language plpgsql security definer as $$
declare
  v_credits int;
  v_today   date := current_date;
  v_streak  user_streaks%rowtype;
begin
  select streak_freeze_credits into v_credits
  from profiles where id = p_user_id and is_pro = true;

  if v_credits is null or v_credits <= 0 then return false; end if;

  if exists (
    select 1 from streak_freeze_uses
    where user_id = p_user_id and freeze_date = v_today
  ) then return false; end if;

  select * into v_streak from user_streaks where user_id = p_user_id;

  insert into streak_freeze_uses (user_id, freeze_date) values (p_user_id, v_today);

  update profiles
  set streak_freeze_credits = streak_freeze_credits - 1
  where id = p_user_id;

  -- Extend last_active_date to today so tomorrow's workout still continues the streak
  insert into user_streaks (user_id, current_streak, longest_streak, last_active_date, updated_at)
  values (
    p_user_id,
    coalesce(v_streak.current_streak, 1),
    coalesce(v_streak.longest_streak, 1),
    v_today,
    now()
  )
  on conflict (user_id) do update
    set last_active_date = v_today,
        updated_at = now();

  return true;
end;
$$;

-- 4. Give 1 freeze credit to all Pro users on the 1st of each month
-- (Schedule separately: SELECT cron.schedule('monthly-freeze-credits', '0 0 1 * *',
--   $$UPDATE profiles SET streak_freeze_credits = LEAST(streak_freeze_credits + 1, 3)
--     WHERE is_pro = true AND (pro_expires_at IS NULL OR pro_expires_at > now());$$))

-- 5. Give 1 credit immediately when a user goes Pro (via revenuecat-webhook upsert)
-- No trigger needed — revenuecat-webhook sets is_pro=true; give credits via:
-- UPDATE profiles SET streak_freeze_credits = GREATEST(streak_freeze_credits, 1) WHERE id = $userId

-- 6. RLS: public challenges (is_public=true) require Pro
drop policy if exists "public_challenge_requires_pro" on fitness_challenges;
create policy "public_challenge_requires_pro" on fitness_challenges
  for insert with check (
    is_public = false
    or exists (
      select 1 from profiles where id = auth.uid() and is_pro = true
    )
  );
