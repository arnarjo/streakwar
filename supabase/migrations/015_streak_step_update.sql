-- The insert trigger resets streak when steps are first inserted but below 7500.
-- When HC re-syncs later in the day with a higher step count it does an UPDATE,
-- not an INSERT, so the insert trigger never fires again. This trigger handles
-- that case: it awards the streak when steps cross the 7500 threshold on update.

create or replace function update_streak_on_step_update()
returns trigger language plpgsql security definer as $$
declare
  v_last_date date;
  v_current   integer;
  v_longest   integer;
begin
  -- Only handle step rows crossing the threshold
  if new.activity_type != 'ganga' then return new; end if;
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
    return new; -- same day already counted or workout_date is in the past beyond yesterday
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

drop trigger if exists on_step_update_streak on workout_posts;
create trigger on_step_update_streak
  after update of steps on workout_posts
  for each row execute function update_streak_on_step_update();
