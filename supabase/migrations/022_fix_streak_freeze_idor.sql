-- Fix IDOR vulnerability in use_streak_freeze RPC.
-- The original function accepted an arbitrary p_user_id without verifying that
-- the caller is the same user, allowing any authenticated user to burn another
-- user's streak-freeze credits.  This replacement adds an auth.uid() guard as
-- the very first statement in the function body.

create or replace function use_streak_freeze(p_user_id uuid)
returns boolean language plpgsql security definer as $$
declare
  v_credits int;
  v_today   date := current_date;
  v_streak  user_streaks%rowtype;
begin
  -- SECURITY: caller must be the user whose freeze is being consumed.
  if auth.uid() is distinct from p_user_id then
    raise exception 'unauthorized';
  end if;

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

  -- Extend last_active_date to today so tomorrow's workout still continues the streak.
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
