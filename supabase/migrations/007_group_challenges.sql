-- StreakWar – Group challenges: max_participants + days_active scoring
-- Run in Supabase SQL Editor after 006

-- ── Max participants cap ───────────────────────────────────────
alter table fitness_challenges
  add column if not exists max_participants integer;
-- null = unlimited

-- ── Days Active scoring mode ──────────────────────────────────
-- Replace the points trigger to add days_active support
create or replace function award_points_on_workout()
returns trigger language plpgsql security definer as $$
declare
  v_challenge fitness_challenges%rowtype;
  v_points    integer := 0;
begin
  if new.challenge_id is null then return new; end if;

  select * into v_challenge from fitness_challenges where id = new.challenge_id;
  if not found then return new; end if;

  -- workouts: fixed points per workout
  if 'workouts' = any(v_challenge.scoring_modes) then
    v_points := v_points + coalesce(v_challenge.points_per_workout, 1);
  end if;

  -- days_active: 1 point per unique calendar day (first workout of day only)
  if 'days_active' = any(v_challenge.scoring_modes) then
    if not exists (
      select 1 from workout_posts
      where challenge_id = new.challenge_id
        and user_id = new.user_id
        and workout_date = new.workout_date
        and id != new.id
    ) then
      v_points := v_points + 1;
    end if;
  end if;

  -- steps
  if 'steps' = any(v_challenge.scoring_modes) and new.steps is not null then
    v_points := v_points + floor(new.steps / 1000.0 * coalesce(v_challenge.points_per_1000_steps, 1))::integer;
  end if;

  -- distance
  if 'distance_km' = any(v_challenge.scoring_modes) and new.distance_km is not null then
    v_points := v_points + floor(new.distance_km * coalesce(v_challenge.points_per_km, 1))::integer;
  end if;

  -- duration
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
