-- Fix 1: Atomic use_streak_freeze to prevent TOCTOU race condition.
--   Previous: SELECT credits → check → INSERT use → UPDATE credits  (two concurrent calls
--   could both read credits=1 and both proceed)
--   Fix: atomic UPDATE with WHERE credits > 0, then check ROW_COUNT.
--   The UNIQUE constraint on streak_freeze_uses rejects any second concurrent INSERT.

create or replace function use_streak_freeze(p_user_id uuid)
returns boolean language plpgsql security definer as $$
declare
  v_affected int;
  v_today    date := current_date;
  v_streak   user_streaks%rowtype;
begin
  -- Guard: already used a freeze today
  if exists (
    select 1 from streak_freeze_uses
    where user_id = p_user_id and freeze_date = v_today
  ) then return false; end if;

  -- Atomically decrement credits — only succeeds if user is Pro AND has credits left.
  -- This eliminates the SELECT-then-UPDATE race window.
  update profiles
  set streak_freeze_credits = streak_freeze_credits - 1
  where id = p_user_id
    and is_pro = true
    and streak_freeze_credits > 0;

  get diagnostics v_affected = row_count;
  if v_affected = 0 then return false; end if;

  -- Record the freeze day (UNIQUE constraint prevents duplicate on concurrent call)
  insert into streak_freeze_uses (user_id, freeze_date)
  values (p_user_id, v_today)
  on conflict (user_id, freeze_date) do nothing;

  -- Extend last_active_date to today so tomorrow's workout continues the streak
  select * into v_streak from user_streaks where user_id = p_user_id;

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


-- Fix 2: Update streak qualification triggers to recognise 'walk' type with steps >= 7500.
--   Both Health Connect and HealthKit now sync step-based activities as activity_type='walk'
--   (not 'ganga'). Without this fix, step days never qualify for streaks.

create or replace function update_streak_on_workout()
returns trigger language plpgsql security definer as $$
declare
  v_last_date date;
  v_current   integer;
  v_longest   integer;
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
    set current_streak   = excluded.current_streak,
        longest_streak   = excluded.longest_streak,
        last_active_date = excluded.last_active_date,
        updated_at       = excluded.updated_at;

  return new;
end;
$$;


create or replace function update_streak_on_step_update()
returns trigger language plpgsql security definer as $$
declare
  v_last_date date;
  v_current   integer;
  v_longest   integer;
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
    set current_streak   = excluded.current_streak,
        longest_streak   = excluded.longest_streak,
        last_active_date = excluded.last_active_date,
        updated_at       = excluded.updated_at;

  return new;
end;
$$;
