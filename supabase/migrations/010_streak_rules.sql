-- Streak qualification rules:
--   Exercise session: >= 20 minutes duration
--   Steps day: >= 7,500 steps
-- A workout_post qualifies if it meets either threshold.

create or replace function update_streak_on_workout()
returns trigger language plpgsql security definer as $$
declare
  v_last_date date;
  v_current   integer;
  v_longest   integer;
  v_qualifies boolean;
begin
  -- Check if this workout meets the streak threshold
  v_qualifies := (
    -- Exercise session >= 20 min
    (new.activity_type != 'ganga' AND coalesce(new.duration_minutes, 0) >= 20)
    OR
    -- Steps >= 7,500 (steps tracked as 'ganga' with steps column)
    (new.activity_type = 'ganga' AND coalesce(new.steps, 0) >= 7500)
    OR
    -- Non-steps walking/hiking with >= 20 min duration
    (new.activity_type = 'ganga' AND coalesce(new.duration_minutes, 0) >= 20 AND coalesce(new.steps, 0) = 0)
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
    -- Same day already counted
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
  for each row execute function update_streak_on_workout();
